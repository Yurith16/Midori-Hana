import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import { generateWAMessageFromContent, generateWAMessage } from '@whiskeysockets/baileys'
import { getRealJid, cleanNumber } from './utils/jid.js'
import { logCommand, logError, logMessage, logEvent } from './utils/logger.js'
import { watchPlugins } from './utils/pluginWatcher.js'
import { getGroupConfig, loadDatabase, trackActivity, updateGroupName, isUserMuted } from './database/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const logger     = pino({ level: 'silent' })

let config   = null
let commands = new Map()

await loadDatabase()

async function reloadConfig() {
  try {
    const newConfig = await import(`./config.js?update=${Date.now()}`)
    config          = newConfig.default
    global.config   = config
    logEvent('Configuración', 'Recargada')
  } catch (err) {
    logError(err, 'Recargando config')
  }
}

await reloadConfig()
fs.watch(path.join(__dirname, 'config.js'), () => reloadConfig())

export async function forceReloadConfig() {
  await reloadConfig()
}

async function reloadPlugins() {
  logEvent('Plugins', 'Recargando...')
  commands.clear()
  const pluginsDir = path.join(__dirname, 'plugins')
  if (!fs.existsSync(pluginsDir)) return
  await scanDir(pluginsDir, true)
  logEvent('Plugins', `${commands.size} disponibles`)
}

async function scanDir(dir, hot = false) {
  const files = fs.readdirSync(dir)
  await Promise.all(files.map(async file => {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      await scanDir(fullPath, hot)
    } else if (file.endsWith('.js')) {
      try {
        const url    = hot ? `file://${fullPath}?update=${Date.now()}` : `file://${fullPath}`
        const plugin = await import(url)
        const cmd    = plugin.default
        if (cmd?.command) {
          const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
          names.forEach(name => commands.set(name, cmd))
        }
      } catch (err) {
        logError(err, file)
      }
    }
  }))
}

watchPlugins(() => reloadPlugins())
await scanDir(path.join(__dirname, 'plugins'), false)
logEvent('Comandos', `${commands.size} disponibles`)

const userNames    = new Map()
const userCommands = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [id, data] of userCommands) {
    if (now - data.timestamp > (config?.spamTime || 60000)) userCommands.delete(id)
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

async function isSubbotOwner(sock, sender, msg, subbotNumero) {
  if (!subbotNumero) return false
  let num = sender.split('@')[0]
  try {
    const real = await getRealJid(sock, sender, msg)
    num = cleanNumber(real)
  } catch {}
  return num === subbotNumero
}

async function isGroupAdmin(sock, groupId, userId) {
  try {
    const meta    = await sock.groupMetadata(groupId)
    const realJid = await getRealJid(sock, userId, { key: { remoteJid: groupId } }).catch(() => userId)
    const userNum = cleanNumber(realJid)
    return meta.participants.some(p => cleanNumber(p.id) === userNum && (p.admin === 'admin' || p.admin === 'superadmin'))
  } catch { return false }
}

async function getGroupName(sock, groupId) {
  try { return (await sock.groupMetadata(groupId)).subject } catch { return null }
}

async function getUserName(sock, userId, pushName = null) {
  if (pushName) { userNames.set(userId, pushName); return pushName }
  if (userNames.has(userId)) return userNames.get(userId)
  let name = userId.split('@')[0]
  try {
    const contact = await sock.getContact(userId)
    name = contact.notify || contact.name || name
  } catch {}
  userNames.set(userId, name)
  return name
}

const LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me|whatsapp\.com|t\.me|telegram\.me|telegram\.dog|telegramchannels\.me|t\.dog)\/[^\s]*/i

function hasLink(text) { return text ? LINK_REGEX.test(text) : false }

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

function getPrefixes(cfg) {
  const p = cfg?.prefix
  return Array.isArray(p) ? p : (p ? [p] : ['.'])
}

function getCommandText(text, cfg) {
  for (const prefix of getPrefixes(cfg)) {
    if (text.startsWith(prefix)) {
      return { matched: true, prefix, text: text.slice(prefix.length) }
    }
  }
  return { matched: false }
}

async function resolveDisplaySender(sock, sender, msg) {
  try { return await getRealJid(sock, sender, msg) } catch { return sender }
}

function getGroupConfigFromDb(db, groupId) {
  if (!db.data.groups[groupId]) {
    db.data.groups[groupId] = {
      groupName: '', antiLink: false, adminMode: false,
      welcomeMessage: false, welcomeText: '', goodbyeText: '',
      nsfwEnabled: false, reactionEnabled: false,
      activity: {}, warns: {}, mutedUsers: {}
    }
    db.write()
  }
  const g = db.data.groups[groupId]
  if (!g.activity)   { g.activity = {};   db.write() }
  if (!g.warns)      { g.warns = {};      db.write() }
  if (!g.mutedUsers) { g.mutedUsers = {}; db.write() }
  return g
}

export async function handleMessage(sock, msg, store, subbotDb = null, subbotSettings = null) {
  if (!config) return
  if (sock.ev) sock.logger = logger
  if (!sock.generateWAMessageFromContent) sock.generateWAMessageFromContent = generateWAMessageFromContent
  const from = msg.key?.remoteJid
  if (!from) return
  _processMessage(sock, msg, store, from, subbotDb, subbotSettings).catch(() => {})
}

async function _processMessage(sock, msg, store, from, subbotDb = null, subbotSettings = null) {
  try {
    const subbotNumero = sock.__numero || null

    // Merge: el subbot hereda todo del config principal
    // y solo sobreescribe lo que tiene en su settings
    const effectiveCfg = (subbotSettings && Object.keys(subbotSettings).length > 0)
      ? { ...config, ...subbotSettings }
      : config

    const isGroup  = from.endsWith('@g.us')
    const sender   = msg.key.participant || from

    let realSenderJid = sender
    try { realSenderJid = await getRealJid(sock, sender, msg) } catch {}
    const senderNumber = cleanNumber(realSenderJid)

    const isUserOwner     = await isOwner(sock, sender, msg, msg.key.fromMe)
    const isSubbotOwnMsg  = await isSubbotOwner(sock, sender, msg, subbotNumero)
    const userName        = msg.pushName

    if (isGroup && !msg.key.fromMe) {
      trackActivity(from, senderNumber)
      const gName = await getGroupName(sock, from)
      if (gName) updateGroupName(from, gName)
    }

    const groupCfg = isGroup
      ? (subbotDb ? getGroupConfigFromDb(subbotDb, from) : getGroupConfig(from))
      : null

    if (isGroup && groupCfg?.antiLink && !isUserOwner && !isSubbotOwnMsg) {
      const isAdmin = await isGroupAdmin(sock, from, sender)
      if (!isAdmin && hasLink(extractText(msg))) {
        try {
          await sock.sendMessage(from, { delete: msg.key })
          await sock.sendMessage(from, { text: effectiveCfg.antiLinkMessage }, { quoted: msg })
        } catch {}
        return
      }
    }

    if (effectiveCfg.autoRead && !msg.key.fromMe) {
      try { await sock.readMessages([msg.key]) } catch {}
    }

    if (userName) await getUserName(sock, sender, userName)

    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption ||
                 msg.message?.documentMessage?.caption || ''

    if (isGroup && !isUserOwner && !isSubbotOwnMsg) {
      const isMuted = isUserMuted(from, senderNumber)
      if (isMuted) {
        const isAdmin = await isGroupAdmin(sock, from, sender)
        if (!isAdmin) {
          try {
            await sock.sendMessage(from, {
              delete: { remoteJid: from, fromMe: false, id: msg.key.id, participant: sender }
            })
          } catch {}
          return
        }
      }
    }

    const { matched, prefix, text: cmdText } = getCommandText(text, effectiveCfg)

    if (!text || !matched) {
      if (text) {
        const triviaPlugin = Array.from(commands.values()).find(p => p.onMessage)
        if (triviaPlugin) await triviaPlugin.onMessage(sock, msg, { from, text })
        const groupName     = isGroup ? await getGroupName(sock, from) : null
        const displaySender = await resolveDisplaySender(sock, sender, msg)
        logMessage({ sender: displaySender, message: text, isGroup, groupName, userName })
      }
      return
    }

    const args    = cmdText.trim().split(/\s+/)
    const cmdName = args.shift().toLowerCase()
    const cmd     = commands.get(cmdName)

    if (!cmd) {
      const triviaPlugin = Array.from(commands.values()).find(p => p.onMessage)
      if (triviaPlugin) await triviaPlugin.onMessage(sock, msg, { from, text })
      return
    }

    if (isGroup && groupCfg?.adminMode && !isUserOwner && !isSubbotOwnMsg) {
      const isAdmin = await isGroupAdmin(sock, from, sender)
      if (!isAdmin) {
        await sock.sendMessage(from, { text: effectiveCfg.adminModeMessage }, { quoted: msg })
        return
      }
    }

    if (effectiveCfg.maintenance && !isUserOwner && !isSubbotOwnMsg) {
      await sock.sendMessage(from, { text: effectiveCfg.maintenanceMessage }, { quoted: msg })
      return
    }

    if (effectiveCfg.antiSpam && !isUserOwner && !isSubbotOwnMsg) {
      const now  = Date.now()
      let data   = userCommands.get(sender)
      if (!data) data = { count: 1, timestamp: now }
      else if (now - data.timestamp > effectiveCfg.spamTime) data = { count: 1, timestamp: now }
      else data.count++
      userCommands.set(sender, data)
      if (data.count > effectiveCfg.spamLimit) {
        const rest = Math.ceil((effectiveCfg.spamTime - (now - data.timestamp)) / 1000)
        await sock.sendMessage(from, { text: `${effectiveCfg.spamMessage}\n⏳ Espera ${rest}s` }, { quoted: msg })
        return
      }
    }

    const groupName = isGroup ? await getGroupName(sock, from) : null

    if (!isGroup && !effectiveCfg.allowPrivate && !isUserOwner && !isSubbotOwnMsg) {
      await sock.sendMessage(from, {
        text: `Los comandos solo están disponibles en el grupo oficial.\n${effectiveCfg.grupoOficial}`
      }, { quoted: msg })
      return
    }

    if (cmd.nsfw && isGroup && !groupCfg?.nsfwEnabled && !isUserOwner) {
      await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
      await sock.sendMessage(from, {
        text: 'El contenido +18 no está habilitado en este grupo.'
      }, { quoted: msg })
      return
    }

    const displaySender = await resolveDisplaySender(sock, sender, msg)

    logCommand({
      command:  cmdName,
      sender:   displaySender,
      userName: userName || await getUserName(sock, sender),
      isOwner:  isUserOwner,
      isGroup,
      groupName,
      args,
      prefix
    })

    if (cmd.owner && !isUserOwner) {
      await sock.sendMessage(from, { text: 'Este comando es exclusivo del owner 🔒' }, { quoted: msg })
      return
    }

    if (cmd.group && !isGroup) {
      await sock.sendMessage(from, { text: 'Este comando solo funciona en grupos 👥' }, { quoted: msg })
      return
    }

    await cmd.execute(sock, msg, {
      args, from, isGroup, sender,
      isOwner:       isUserOwner,
      isSubbotOwner: isSubbotOwnMsg,
      subbotNumero,
      groupName,
      store,
      config: effectiveCfg
    })

  } catch (err) {
    if (err?.message?.includes('Bad MAC') || err?.message?.includes('decrypt') || err?.message?.includes('session')) return
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

export default { handleMessage, initializeAntiCall }