import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import config from './config.js'
import { logCommand, logError, logPlugin, logMessage, logEvent } from './utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const commands = new Map()
const userNames = new Map()

// Verificar owner
function isOwner(sender, fromMe) {
  if (fromMe) return true
  const cleanSender = sender.split('@')[0]
  return config.ownerNumbers.some(owner => {
    const cleanOwner = owner.split('@')[0]
    return cleanSender === cleanOwner
  })
}

// Obtener nombre del grupo
async function getGroupName(sock, groupId) {
  try {
    const metadata = await sock.groupMetadata(groupId)
    return metadata.subject
  } catch {
    return null
  }
}

// Obtener nombre de usuario
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

// Cargar plugins
async function loadCommands() {
  const pluginsDir = path.join(__dirname, 'plugins')
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true })
    return
  }

  async function scanDir(dir) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        await scanDir(fullPath)
      } else if (file.endsWith('.js')) {
        try {
          const plugin = await import(`file://${fullPath}`)
          const cmd = plugin.default
          if (cmd && cmd.command) {
            const cmdNames = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
            cmdNames.forEach(name => commands.set(name, cmd))
            logPlugin(cmdNames.join(', '))
          }
        } catch (err) {
          logError(err, `Cargando ${file}`)
        }
      }
    }
  }
  await scanDir(pluginsDir)
  logEvent('Comandos cargados', `${commands.size} disponibles`)
}

// Handler principal
export async function handleMessage(sock, msg, store) {
  try {
    const messageText = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || ''

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || from
    const fromMe = msg.key.fromMe || false
    const isUserOwner = isOwner(sender, fromMe)
    const userName = msg.pushName || null

    if (userName) {
      await getUserName(sock, sender, userName)
    }

    // Mensajes sin comando
    if (!messageText || !messageText.startsWith(config.prefix)) {
      if (messageText) {
        const groupName = isGroup ? await getGroupName(sock, from) : null
        logMessage({ sender, message: messageText, isGroup, groupName, userName })
      }
      return
    }

    // Procesar comando
    const args = messageText.slice(config.prefix.length).trim().split(/\s+/)
    const commandName = args.shift().toLowerCase()
    const cmd = commands.get(commandName)
    if (!cmd) return

    const groupName = isGroup ? await getGroupName(sock, from) : null

    // Verificar privado
    if (!isGroup && !config.allowPrivate && !isUserOwner) {
      await sock.sendMessage(from, { 
        text: `🔒 *Comandos solo en el grupo oficial*\n\n${config.grupoOficial}` 
      }, { quoted: msg })
      return
    }

    // Log del comando
    logCommand({
      command: commandName,
      sender: sender.split('@')[0],
      userName: userName || await getUserName(sock, sender),
      isOwner: isUserOwner,
      isGroup,
      groupName,
      args,
      prefix: config.prefix
    })

    // Verificar owner
    if (cmd.owner && !isUserOwner) {
      await sock.sendMessage(from, { text: '🔒 Solo el owner' }, { quoted: msg })
      return
    }

    // Verificar grupo
    if (cmd.group && !isGroup) {
      await sock.sendMessage(from, { text: '👥 Solo en grupos' }, { quoted: msg })
      return
    }

    // Ejecutar comando
    await cmd.execute(sock, msg, {
      args,
      from,
      isGroup,
      sender,
      isOwner: isUserOwner,
      groupName,
      store,
      config
    })

  } catch (err) {
    logError(err, 'Handler')
  }
}

export function initializeAntiCall(sock) {
  logEvent('Anti-call', 'Inicializado')
}

await loadCommands()

export default {
  handleMessage,
  initializeAntiCall
}