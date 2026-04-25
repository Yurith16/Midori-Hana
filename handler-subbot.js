import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pino from 'pino'
import { generateWAMessageFromContent, generateWAMessage } from '@whiskeysockets/baileys'
import { getRealJid, cleanNumber } from './utils/jid.js'
import { logCommand, logError, logMessage, logEvent } from './utils/logger.js'
import { watchPlugins } from './utils/pluginWatcher.js'
import {
  getSubbotGroupConfig,
  updateSubbotGroupConfig,
  trackSubbotActivity,
  updateSubbotGroupName,
  isSubbotUserMuted,
  getSubbotSettings
} from './database/db-subbot.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const logger     = pino({ level: 'silent' })

let config   = null
let commands = new Map()

// ========== SISTEMA DE CACHÉ ==========
const groupMetadataCache = new Map() // groupId -> { data, timestamp }
const groupNameCache = new Map()     // groupId -> { name, timestamp }
const settingsCache = new Map()      // subbotNumero -> { settings, timestamp }
const groupConfigCache = new Map()   // `${subbotNumero}:${groupId}` -> { config, timestamp }

const CACHE_TTL = {
  GROUP_METADATA: 5 * 60 * 1000,  // 5 minutos
  GROUP_NAME: 10 * 60 * 1000,     // 10 minutos
  SETTINGS: 30 * 60 * 1000,       // 30 minutos
  GROUP_CONFIG: 60 * 60 * 1000    // 1 hora
}

function getCached(key, cache, ttl) {
  const cached = cache.get(key)
  if (cached && (Date.now() - cached.timestamp) < ttl) {
    return cached.data
  }
  return null
}

function setCached(key, data, cache) {
  cache.set(key, { data, timestamp: Date.now() })
}

// Limpiar caché cada hora
setInterval(() => {
  groupMetadataCache.clear()
  groupNameCache.clear()
  settingsCache.clear()
  groupConfigCache.clear()
  console.log('[CACHE] Limpieza completa de caché')
}, 60 * 60 * 1000)

// ========== FIN CACHÉ ==========

async function reloadConfig() {
  try {
    const newConfig = await import(`./config.js?update=${Date.now()}`)
    config          = newConfig.default
    logEvent('Subbot Config', 'Recargada')
  } catch (err) {
    logError(err, 'Subbot reloadConfig')
  }
}

await reloadConfig()
fs.watch(path.join(__dirname, 'config.js'), () => reloadConfig())

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

watchPlugins(() => {
  logEvent('Subbot Plugins', 'Recargando...')
  commands.clear()
  const pluginsDir = path.join(__dirname, 'plugins')
  if (fs.existsSync(pluginsDir)) scanDir(pluginsDir, true)
})

await scanDir(path.join(__dirname, 'plugins'), false)
logEvent('Subbot Comandos', `${commands.size} disponibles`)

const userNames    = new Map()
const userCommands = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [id, data] of userCommands) {
    if (now - data.timestamp > (config?.spamTime || 60000)) userCommands.delete(id)
  }
}, 60000)

async function isMainOwner(sock, sender, msg, fromMe) {
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
    const meta = await getGroupMetadataWithCache(sock, groupId)
    const realJid = await getRealJid(sock, userId, { key: { remoteJid: groupId } }).catch(() => userId)
    const userNum = cleanNumber(realJid)
    return meta.participants.some(p => cleanNumber(p.id) === userNum && (p.admin === 'admin' || p.admin === 'superadmin'))
  } catch { return false }
}

async function getGroupMetadataWithCache(sock, groupId) {
  const cached = getCached(groupId, groupMetadataCache, CACHE_TTL.GROUP_METADATA)
  if (cached) return cached
  
  const metadata = await sock.groupMetadata(groupId)
  setCached(groupId, metadata, groupMetadataCache)
  return metadata
}

async function getGroupNameWithCache(sock, groupId) {
  const cached = getCached(groupId, groupNameCache, CACHE_TTL.GROUP_NAME)
  if (cached) return cached
  
  try {
    const name = (await sock.groupMetadata(groupId)).subject
    setCached(groupId, name, groupNameCache)
    return name
  } catch { return null }
}

async function getSubbotSettingsWithCache(subbotNumero) {
  const cached = getCached(subbotNumero, settingsCache, CACHE_TTL.SETTINGS)
  if (cached) return cached
  
  const settings = await getSubbotSettings(subbotNumero)
  setCached(subbotNumero, settings, settingsCache)
  return settings
}

async function getSubbotGroupConfigWithCache(subbotNumero, groupId) {
  const key = `${subbotNumero}:${groupId}`
  const cached = getCached(key, groupConfigCache, CACHE_TTL.GROUP_CONFIG)
  if (cached) return cached
  
  const config = await getSubbotGroupConfig(subbotNumero, groupId)
  setCached(key, config, groupConfigCache)
  return config
}

async function getUserNameWithCache(sock, userId, pushName = null) {
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

function getPrefixesFromSettings(cfg, subbotPrefijos) {
  if (subbotPrefijos && Array.isArray(subbotPrefijos) && subbotPrefijos.length > 0) {
    return subbotPrefijos
  }
  const p = cfg?.prefix
  return Array.isArray(p) ? p : (p ? [p] : ['.'])
}

function getCommandText(text, prefixes) {
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      return { matched: true, prefix, text: text.slice(prefix.length) }
    }
  }
  return { matched: false }
}

async function resolveDisplaySender(sock, sender, msg) {
  try { return await getRealJid(sock, sender, msg) } catch { return sender }
}

export async function handleSubbotMessage(sock, msg, store) {
  if (!config) return
  if (sock.ev) sock.logger = logger
  if (!sock.generateWAMessageFromContent) sock.generateWAMessageFromContent = generateWAMessageFromContent
  const from = msg.key?.remoteJid
  if (!from) return
  _processSubbotMessage(sock, msg, store, from).catch(() => {})
}

async function _processSubbotMessage(sock, msg, store, from) {
  try {
    const subbotNumero = sock.__numero

    const settings = await getSubbotSettingsWithCache(subbotNumero)
    const effectiveCfg = {
      ...config,
      prefix:       settings.prefix       ?? config.prefix,
      autoRead:     settings.autoRead     ?? config.autoRead,
      autoBio:      settings.autoBio      ?? config.autoBio,
      antiCall:     settings.antiCall     ?? config.antiCall,
      antiSpam:     settings.antiSpam     ?? config.antiSpam,
      allowPrivate: settings.allowPrivate ?? config.allowPrivate
    }

    const isGroup  = from.endsWith('@g.us')
    const sender   = msg.key.participant || from

    let realSenderJid = sender
    try { realSenderJid = await getRealJid(sock, sender, msg) } catch {}
    const senderNumber = cleanNumber(realSenderJid)

    const isUserOwner    = await isMainOwner(sock, sender, msg, msg.key.fromMe)
    const isSubbotOwnMsg = await isSubbotOwner(sock, sender, msg, subbotNumero)
    const userName       = msg.pushName

    if (isGroup && !msg.key.fromMe) {
      await trackSubbotActivity(subbotNumero, from, senderNumber)
      const gName = await getGroupNameWithCache(sock, from)
      if (gName) await updateSubbotGroupName(subbotNumero, from, gName)
    }

    const groupCfg = isGroup
      ? await getSubbotGroupConfigWithCache(subbotNumero, from)
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

    if (userName) await getUserNameWithCache(sock, sender, userName)

    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 msg.message?.imageMessage?.caption ||
                 msg.message?.videoMessage?.caption ||
                 msg.message?.documentMessage?.caption || ''

    if (isGroup && !isUserOwner && !isSubbotOwnMsg) {
      const isMuted = await isSubbotUserMuted(subbotNumero, from, senderNumber)
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

    const subbotPrefijos = settings.prefijos
    const prefixes = getPrefixesFromSettings(effectiveCfg, subbotPrefijos)
    const { matched, prefix, text: cmdText } = getCommandText(text, prefixes)

    if (!text || !matched) {
      if (text) {
        const triviaPlugin = Array.from(commands.values()).find(p => p.onMessage)
        if (triviaPlugin) await triviaPlugin.onMessage(sock, msg, { from, text })
        const groupName     = isGroup ? await getGroupNameWithCache(sock, from) : null
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

    const groupName = isGroup ? await getGroupNameWithCache(sock, from) : null

    if (!isGroup && !effectiveCfg.allowPrivate && !isUserOwner && !isSubbotOwnMsg) {
      await sock.sendMessage(from, {
        text: `Los comandos solo están disponibles en el grupo oficial.\n${effectiveCfg.grupoOficial}`
      }, { quoted: msg })
      return
    }

    if (cmd.nsfw && isGroup && !groupCfg?.nsfwEnabled && !isUserOwner) {
      await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
      await sock.sendMessage(from, { text: 'El contenido +18 no está habilitado en este grupo.' }, { quoted: msg })
      return
    }

    const displaySender = await resolveDisplaySender(sock, sender, msg)

    logCommand({
      command:  cmdName,
      sender:   displaySender,
      userName: userName || await getUserNameWithCache(sock, sender),
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
    logError(err, 'HandlerSubbot')
  }
}

export function initializeSubbotAntiCall(sock) {
  const numero = sock.__numero
  sock.ev.on('call', async (calls) => {
    try {
      const settings = await getSubbotSettingsWithCache(numero)
      if (!settings?.antiCall) return
      for (const call of calls) {
        if (call.status === 'offer') {
          try { await sock.rejectCall(call.id, call.from) } catch {}
        }
      }
    } catch {}
  })
}

export async function initializeSubbotWelcome(sock, subbotNumero) {
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update
    if (action !== 'add') return
    
    try {
      const cfg = await getSubbotGroupConfigWithCache(subbotNumero, id)
      
      if (!cfg.welcomeMessage) return
      
      for (const p of participants) {
        let participantId = typeof p === 'string' ? p : (p.id || p.jid || p)
        const plantilla = cfg.welcomeText || '> 👋 Bienvenido @user al grupo'
        const mensaje = plantilla.replace('@user', `@${participantId.split('@')[0]}`)
        await sock.sendMessage(id, { text: mensaje, mentions: [participantId] })
      }
    } catch (err) {
      console.error(`[SUBBOT ${subbotNumero}] Error en bienvenida:`, err.message)
    }
  })
}

export default { 
  handleSubbotMessage, 
  initializeSubbotAntiCall,
  initializeSubbotWelcome
}