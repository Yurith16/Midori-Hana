import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
//import { getGroupConfig, loadDatabase } from './database/db.js'
import { getRealJid, cleanNumber } from './utils/jid.js'
import { logCommand, logError, logPlugin, logMessage, logEvent } from './utils/logger.js'
import { watchPlugins } from './utils/pluginWatcher.js'
import { getGroupConfig, loadDatabase } from './database/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let config = null
let commands = new Map()

// Cargar DB
await loadDatabase()

async function reloadConfig() {
  try {
    const newConfig = await import(`./config.js?update=${Date.now()}`)
    config = newConfig.default
    logEvent('Configuración', 'Recargada')
  } catch (err) {
    logError(err, 'Recargando config')
  }
}

await reloadConfig()

fs.watch(path.join(__dirname, 'config.js'), () => reloadConfig())

async function reloadPlugins() {
  logEvent('Plugins', 'Recargando...')
  commands.clear()
  
  const pluginsDir = path.join(__dirname, 'plugins')
  if (!fs.existsSync(pluginsDir)) return

  async function scanDir(dir) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        await scanDir(fullPath)
      } else if (file.endsWith('.js')) {
        try {
          const plugin = await import(`file://${fullPath}?update=${Date.now()}`)
          const cmd = plugin.default
          if (cmd?.command) {
            const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
            names.forEach(name => commands.set(name, cmd))
          }
        } catch (err) {
          logError(err, file)
        }
      }
    }
  }
  await scanDir(pluginsDir)
  logEvent('Plugins', `${commands.size} disponibles`)
}

watchPlugins(() => reloadPlugins())

const userNames = new Map()
const userCommands = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [id, data] of userCommands) {
    if (now - data.timestamp > config?.spamTime) userCommands.delete(id)
  }
}, 60000)

async function isOwner(sock, sender, msg, fromMe) {
  if (fromMe) return true
  let num = sender.split('@')[0]
  try {
    const real = await getRealJid(sock, sender, msg)
    num = cleanNumber(real)
  } catch {}
  return config?.ownerNumbers?.some(o => cleanNumber(o) === num) || false
}

async function isGroupAdmin(sock, groupId, userId) {
  try {
    const meta = await sock.groupMetadata(groupId)
    const userNum = cleanNumber(userId)
    return meta.participants.some(p => cleanNumber(p.id) === userNum && (p.admin === 'admin' || p.admin === 'superadmin'))
  } catch { return false }
}

async function getGroupName(sock, groupId) {
  try {
    const meta = await sock.groupMetadata(groupId)
    return meta.subject
  } catch { return null }
}

async function getUserName(sock, userId, pushName = null) {
  if (pushName) {
    userNames.set(userId, pushName)
    return pushName
  }
  if (userNames.has(userId)) return userNames.get(userId)
  let name = userId.split('@')[0]
  try {
    const contact = await sock.getContact(userId)
    name = contact.notify || contact.name || name
  } catch {}
  userNames.set(userId, name)
  return name
}

async function loadCommands() {
  const dir = path.join(__dirname, 'plugins')
  if (!fs.existsSync(dir)) return

  async function scan(d) {
    const files = fs.readdirSync(d)
    for (const file of files) {
      const full = path.join(d, file)
      const stat = fs.statSync(full)
      if (stat.isDirectory()) {
        await scan(full)
      } else if (file.endsWith('.js')) {
        try {
          const plugin = await import(`file://${full}`)
          const cmd = plugin.default
          if (cmd?.command) {
            const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
            names.forEach(n => commands.set(n, cmd))
          }
        } catch (err) {
          logError(err, file)
        }
      }
    }
  }
  await scan(dir)
  logEvent('Comandos', `${commands.size} disponibles`)
}

// Obtener hora actual de Honduras
function getHondurasHour() {
  const now = new Date()
  const hondurasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }))
  return hondurasTime.getHours()
}

export async function handleMessage(sock, msg, store) {
  if (!config) return
  
  try {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const from = msg.key.remoteJid
    if (!from) return
    
    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || from
    const isUserOwner = await isOwner(sock, sender, msg, msg.key.fromMe)
    const userName = msg.pushName

   // Control de horarios (Honduras)
const currentHour = getHondurasHour()
const isActiveHour = currentHour >= config.activeHours.start && currentHour < config.activeHours.end

if (!isActiveHour && !isUserOwner) {
  // Obtener hora actual formateada
  const now = new Date()
  const hondurasTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Tegucigalpa' }))
  const horaFormateada = hondurasTime.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  
  const mensaje = `${config.offlineMessage}\n\n> Bot disponible de ${config.activeHours.start}:00 a ${config.activeHours.end}:00\n> Hora actual en Honduras: ${horaFormateada}`
  
  await sock.sendMessage(from, { text: mensaje }, { quoted: msg })
  return
}
    // Configuración por grupo
    const groupCfg = isGroup ? getGroupConfig(from) : null

    // Modo admin por grupo
    if (isGroup && groupCfg?.adminMode && !isUserOwner) {
      const isAdmin = await isGroupAdmin(sock, from, sender)
      if (!isAdmin) {
        await sock.sendMessage(from, { text: config.adminModeMessage }, { quoted: msg })
        return
      }
    }

    if (config.autoRead && !msg.key.fromMe) {
      try { await sock.readMessages([msg.key]) } catch {}
    }

    if (userName) await getUserName(sock, sender, userName)

    if (!text || !text.startsWith(config.prefix)) {
      if (text) {
        const groupName = isGroup ? await getGroupName(sock, from) : null
        logMessage({ sender, message: text, isGroup, groupName, userName })
      }
      return
    }

    const args = text.slice(config.prefix.length).trim().split(/\s+/)
    const cmdName = args.shift().toLowerCase()
    const cmd = commands.get(cmdName)
    if (!cmd) return

    if (config.maintenance && !isUserOwner) {
      await sock.sendMessage(from, { text: config.maintenanceMessage }, { quoted: msg })
      return
    }

    if (config.antiSpam && !isUserOwner) {
      const now = Date.now()
      let data = userCommands.get(sender)
      if (!data) data = { count: 1, timestamp: now }
      else if (now - data.timestamp > config.spamTime) data = { count: 1, timestamp: now }
      else data.count++
      userCommands.set(sender, data)
      if (data.count > config.spamLimit) {
        const rest = Math.ceil((config.spamTime - (now - data.timestamp)) / 1000)
        await sock.sendMessage(from, { text: `${config.spamMessage}\n⏳ Espera ${rest}s` }, { quoted: msg })
        return
      }
    }

    const groupName = isGroup ? await getGroupName(sock, from) : null

    if (!isGroup && !config.allowPrivate && !isUserOwner) {
      await sock.sendMessage(from, { text: `🔒 *Comandos solo en el grupo oficial*\n\n${config.grupoOficial}` }, { quoted: msg })
      return
    }

    logCommand({
      command: cmdName,
      sender: sender.split('@')[0],
      userName: userName || await getUserName(sock, sender),
      isOwner: isUserOwner,
      isGroup,
      groupName,
      args,
      prefix: config.prefix
    })

    if (cmd.owner && !isUserOwner) {
      await sock.sendMessage(from, { text: '🔒 Solo el owner' }, { quoted: msg })
      return
    }

    if (cmd.group && !isGroup) {
      await sock.sendMessage(from, { text: '👥 Solo en grupos' }, { quoted: msg })
      return
    }

    await cmd.execute(sock, msg, { args, from, isGroup, sender, isOwner: isUserOwner, groupName, store, config })

  } catch (err) {
    logError(err, 'Handler')
  }
}

export function initializeAntiCall(sock) {
  if (!config?.antiCall) return
  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (call.status === 'offer') {
        try {
          await sock.rejectCall(call.id, call.from)
          logEvent('Anti-call', `Llamada rechazada de ${call.from.split('@')[0]}`)
        } catch {}
      }
    }
  })
  logEvent('Anti-call', 'Protección activada')
}

await loadDatabase()
await loadCommands()


export default { handleMessage, initializeAntiCall }