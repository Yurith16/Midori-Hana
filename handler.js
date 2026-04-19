import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import { jidNormalizedUser, getContentType, proto, downloadContentFromMessage, generateWAMessageFromContent, prepareWAMessageMedia, generateWAMessage, delay, jidDecode, generateForwardMessageContent } from '@whiskeysockets/baileys'
import { getRealJid, cleanNumber } from './utils/jid.js'
import { logCommand, logError, logPlugin, logMessage, logEvent } from './utils/logger.js'
import { watchPlugins } from './utils/pluginWatcher.js'
import { getGroupConfig, loadDatabase, trackActivity, updateGroupName, isUserMuted } from './database/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuración de Logger silencioso para evitar spam en consola
const logger = pino({ level: 'silent' })

let config = null
let commands = new Map()

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
    const realJid = await getRealJid(sock, userId, { key: { remoteJid: groupId } })
    const userNum = cleanNumber(realJid)
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

const LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|telegram\.dog|telegramchannels\.me|t\.dog)\/[^\s]*/i

function hasLink(text) {
  if (!text) return false
  return LINK_REGEX.test(text)
}

function extractText(msg) {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
    m.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
    ''
  )
}

function getPrefixes() {
  const p = config?.prefix
  if (Array.isArray(p)) return p
  return p ? [p] : ['.']
}

function getCommandText(text) {
  for (const prefix of getPrefixes()) {
    if (text.startsWith(prefix)) {
      return { matched: true, prefix, text: text.slice(prefix.length) }
    }
  }
  return { matched: false }
}

async function resolveDisplaySender(sock, sender, msg) {
  try {
    const realJid = await getRealJid(sock, sender, msg)
    return realJid
  } catch {
    return sender
  }
}

export async function handleMessage(sock, msg, store) {
  if (!config) return

  // Inyectar logger silencioso en la instancia para callar libsignal
  if (sock.ev) {
    sock.logger = logger
  }

  if (!sock.generateWAMessageFromContent) {
    sock.generateWAMessageFromContent = generateWAMessageFromContent
  }

  try {
    const from = msg.key.remoteJid
    if (!from) return

    const isGroup = from.endsWith('@g.us')
    const sender = msg.key.participant || from

    // Obtención del número real (traducción de @lid)
    const realSenderJid = await getRealJid(sock, sender, msg)
    const senderNumber = cleanNumber(realSenderJid)

    const isUserOwner = await isOwner(sock, sender, msg, msg.key.fromMe)
    const userName = msg.pushName

    // Registrar actividad en grupos
    if (isGroup && !msg.key.fromMe) {
      trackActivity(from, senderNumber)
    }

    // Guardar nombre del grupo en DB
    if (isGroup) {
      const gName = await getGroupName(sock, from)
      if (gName) updateGroupName(from, gName)
    }

    const groupCfg = isGroup ? getGroupConfig(from) : null

    // AntiLink
    if (isGroup && groupCfg?.antiLink && !isUserOwner) {
      const isAdmin = await isGroupAdmin(sock, from, sender)
      if (!isAdmin) {
        const fullText = extractText(msg)
        if (hasLink(fullText)) {
          try {
            await sock.sendMessage(from, { delete: msg.key })
            await sock.sendMessage(from, { text: config.antiLinkMessage }, { quoted: msg })
          } catch {}
          return
        }
      }
    }

    if (config.autoRead && !msg.key.fromMe) {
      try { await sock.readMessages([msg.key]) } catch {}
    }

    if (userName) await getUserName(sock, sender, userName)

    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption ||
                 msg.message?.documentMessage?.caption || ''

    // [BLOQUE DE MUTE REFORZADO]
    if (isGroup && !isUserOwner) {
      const isMuted = isUserMuted(from, senderNumber)
      if (isMuted) {
        const isAdmin = await isGroupAdmin(sock, from, sender)
        if (!isAdmin) {
          console.log(`[MUTE] Borrando mensaje de: ${senderNumber}`)
          try {
            await sock.sendMessage(from, { 
              delete: { 
                remoteJid: from, 
                fromMe: false, 
                id: msg.key.id, 
                participant: sender 
              } 
            })
            return 
          } catch (err) {
            logError(err, 'Error al borrar mensaje muteado')
          }
        }
      }
    }

    const { matched, prefix, text: cmdText } = getCommandText(text)

    if (!text || !matched) {
      if (text) {
        const groupName = isGroup ? await getGroupName(sock, from) : null
        const displaySender = await resolveDisplaySender(sock, sender, msg)
        logMessage({ sender: displaySender, message: text, isGroup, groupName, userName })
      }
      return
    }

    const args = cmdText.trim().split(/\s+/)
    const cmdName = args.shift().toLowerCase()
    const cmd = commands.get(cmdName)
    if (!cmd) return

    // Modo admin
    if (isGroup && groupCfg?.adminMode && !isUserOwner) {
      const isAdmin = await isGroupAdmin(sock, from, sender)
      if (!isAdmin) {
        await sock.sendMessage(from, { text: config.adminModeMessage }, { quoted: msg })
        return
      }
    }

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

    // Verificar NSFW
    if (cmd.nsfw && isGroup && !groupCfg?.nsfwEnabled && !isUserOwner) {
      await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
      await sock.sendMessage(from, { text: '> El contenido +18 no está permitido en este grupo 🍃\n> Un admin puede activarlo con `.enable nsfw`' }, { quoted: msg })
      return
    }

    const displaySender = await resolveDisplaySender(sock, sender, msg)

    logCommand({
      command: cmdName,
      sender: displaySender,
      userName: userName || await getUserName(sock, sender),
      isOwner: isUserOwner,
      isGroup,
      groupName,
      args,
      prefix
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