import { getRealJid, cleanNumber } from '../utils/jid.js'
import { logger, delay }           from '../utils/helpers.js'
import { checkSpam }               from '../utils/spam.js'
import { commands, messageListeners } from './plugins.js'
import {
  getGroup, isMuted, isBanned, muteUser, unmuteUser,
  trackActivity, updateGroupName, saveMsg, isIgnored
} from './sqlite.js'
import { isToxic, getToxicResponse, addWarning, clearWarnings } from '../utils/toxic.js'

const LINK_RE = /(?:https?:\/\/)?(?:www\.)?(?:chat\.whatsapp\.com|wa\.me|t\.me|telegram\.(?:me|dog|org))\/\S+/i

if (!global.lidCache) global.lidCache = new Map()

// ─── Caché de metadata de grupo — evita pedirle a Baileys la lista de admins
//     en cada mensaje; se refresca sola cada 5 minutos por grupo ────────────

const groupMetaCache = new Map()
const GROUP_META_TTL = 5 * 60 * 1000

async function getCachedGroupMetadata(sock, groupId) {
  const cached = groupMetaCache.get(groupId)
  if (cached && Date.now() - cached.ts < GROUP_META_TTL) return cached.meta
  const meta = await sock.groupMetadata(groupId)
  groupMetaCache.set(groupId, { meta, ts: Date.now() })
  return meta
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(msg) {
  const m = msg.message
  return m?.conversation
      || m?.extendedTextMessage?.text
      || m?.imageMessage?.caption
      || m?.videoMessage?.caption
      || m?.documentMessage?.caption
      || m?.viewOnceMessage?.message?.imageMessage?.caption
      || m?.viewOnceMessageV2?.message?.imageMessage?.caption
      || m?.viewOnceMessageV2Extension?.message?.imageMessage?.caption
      || m?.buttonsMessage?.contentText
      || m?.templateMessage?.hydratedTemplate?.hydratedContentText
      || ''
}

function matchPrefix(text, groupCfg) {
  if (groupCfg?.prefix) {
    if (text.startsWith(groupCfg.prefix)) {
      return { prefix: groupCfg.prefix, rest: text.slice(groupCfg.prefix.length).trim() }
    }
    return null
  }
  for (const p of (global.bot?.prefix || ['.'])) {
    if (text.startsWith(p)) return { prefix: p, rest: text.slice(p.length).trim() }
  }
  return null
}

async function resolveContext(sock, msg) {
  const from    = msg.key.remoteJid
  const isGroup = from.endsWith('@g.us')
  const sender  = msg.key.participant || from
  const fromMe  = msg.key.fromMe

  let realJid = sender
  try { realJid = await getRealJid(sock, sender, msg) } catch {}
  const userNum = cleanNumber(realJid)

  if (sender.endsWith('@lid') && userNum && userNum.length >= 8) {
    global.lidCache.set(sender, `${userNum}@s.whatsapp.net`)
  }

  const ownerNums = [global.bot?.ownerNumber].flat().map(n => cleanNumber(n))
  const isOwner   = fromMe || ownerNums.includes(userNum)
  const groupCfg  = isGroup ? getGroup(from) : null

  let isAdmin = false
  if (isGroup) {
    try {
      const meta      = await getCachedGroupMetadata(sock, from)
      const senderRaw = cleanNumber(sender)
      isAdmin = meta.participants.some(p =>
        p.admin && (
          cleanNumber(p.id) === userNum ||
          p.id === sender ||
          cleanNumber(p.id) === senderRaw
        )
      )
      if (meta.subject && meta.subject !== groupCfg?.name) {
        updateGroupName(from, meta.subject)
      }
    } catch {}
  }

  return { from, isGroup, sender, fromMe, realJid, userNum, isOwner, isAdmin, groupCfg }
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────

async function stepAntiLink(ctx, sock, msg) {
  if (!ctx.isGroup || ctx.isOwner || ctx.isAdmin)               return false
  if (!ctx.groupCfg?.antiLink || ctx.groupCfg.antiLink !== 1)   return false
  if (!LINK_RE.test(extractText(msg)))                           return false
  try {
    await sock.sendMessage(ctx.from, { delete: msg.key })
    await sock.sendMessage(ctx.from, { text: global.messages?.antiLink }, { quoted: msg })
  } catch {}
  return true
}

async function stepMute(ctx, sock, msg) {
  if (!ctx.isGroup || ctx.isOwner || ctx.isAdmin) return false
  const senderNum = cleanNumber(ctx.sender)
  if (!isMuted(ctx.from, ctx.userNum) && !isMuted(ctx.from, senderNum)) return false
  try {
    await sock.sendMessage(ctx.from, {
      delete: {
        remoteJid:   ctx.from,
        fromMe:      false,
        id:          msg.key.id,
        participant: ctx.sender
      }
    })
  } catch {}
  return true
}

async function stepAntiToxic(ctx, sock, msg) {
  if (!ctx.isGroup || ctx.isOwner || ctx.isAdmin)               return false
  if (!ctx.groupCfg?.antiToxic || ctx.groupCfg.antiToxic !== 1) return false

  const text = extractText(msg)
  if (!text) return false

  const { toxic } = isToxic(text)
  if (!toxic) return false

  try {
    await sock.sendMessage(ctx.from, { delete: msg.key })

    const warningCount = addWarning(ctx.userNum)
    const response     = getToxicResponse(ctx.userNum, warningCount)

    await sock.sendMessage(ctx.from, {
      text:     response,
      mentions: [`${ctx.userNum}@s.whatsapp.net`]
    })

    if (warningCount >= 3) {
      muteUser(ctx.from, ctx.userNum)
      setTimeout(() => {
        unmuteUser(ctx.from, ctx.userNum)
        clearWarnings(ctx.userNum)
      }, 180000)
    }
  } catch {}

  return true
}

async function stepGuards(ctx, sock, msg) {
  const feat = global.features || {}
  const msgs = global.messages || {}
  const bot  = global.bot      || {}

  if (!ctx.isOwner && isBanned(ctx.userNum)) {
    await sock.sendMessage(ctx.from, { text: msgs.bannedWarn }, { quoted: msg })
    return true
  }

  if (feat.maintenance && !ctx.isOwner) {
    await sock.sendMessage(ctx.from, { text: msgs.maintenance }, { quoted: msg })
    return true
  }

  if (!ctx.isGroup && !feat.allowPrivate && !ctx.isOwner) {
    await sock.sendMessage(ctx.from, {
      text: (msgs.privateOnly || '').replace('{grupoOficial}', bot.grupoOficial || '')
    }, { quoted: msg })
    return true
  }

  if (ctx.isGroup && ctx.groupCfg?.adminMode === 1 && !ctx.isOwner && !ctx.isAdmin) {
    await sock.sendMessage(ctx.from, { text: msgs.adminOnly }, { quoted: msg })
    return true
  }

  if (feat.antiSpam && !ctx.isOwner) {
    const { blocked, secsLeft } = checkSpam(ctx.userNum || ctx.sender)
    if (blocked) {
      await sock.sendMessage(ctx.from, {
        text: (msgs.spamWarn || 'Espera {secs}s').replace('{secs}', secsLeft)
      }, { quoted: msg })
      return true
    }
  }

  return false
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function dispatch(ctx, sock, msg, match) {
  const textStr = extractText(msg) || ''

  for (const cmd of messageListeners) {
    await cmd.onMessage(sock, msg, {
        from:     ctx.from,
        text:     textStr,
        sender:   ctx.sender,
        userNum:  ctx.userNum,
        isGroup:  ctx.isGroup,
        isOwner:  ctx.isOwner,
        isAdmin:  ctx.isAdmin,
        groupCfg: ctx.groupCfg
    }).catch(() => {})
  }

  if (!match) return

  const [cmdName, ...args] = match.rest.split(/\s+/)
  const cmd = commands.get(cmdName.toLowerCase())
  if (!cmd) return

  if (cmd.owner && !ctx.isOwner) {
    await sock.sendMessage(ctx.from, { text: global.messages?.ownerOnly }, { quoted: msg })
    return
  }
  if (cmd.group && !ctx.isGroup) {
    await sock.sendMessage(ctx.from, { text: global.messages?.groupOnly }, { quoted: msg })
    return
  }
  if (ctx.isGroup && !ctx.isOwner && !ctx.isAdmin && isIgnored(ctx.from, ctx.userNum)) return

  logger.cmd(cmdName, ctx.userNum, ctx.isGroup ? ctx.groupCfg?.name : null)

  await delay()
  await cmd.execute(sock, msg, { ...ctx, args, prefix: match.prefix }).catch(err => {
    logger.error('Cmd', `${cmdName} — ${err.message}`)
    sock.sendMessage(ctx.from, { text: global.messages?.error }, { quoted: msg }).catch(() => {})
  })
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function handleMessage(sock, msg) {
  try {
    const ctx = await resolveContext(sock, msg)

    if (ctx.isGroup && !ctx.fromMe) {
      trackActivity(ctx.from, ctx.userNum)
      if (msg.key?.id) saveMsg(ctx.from, msg.key.id, ctx.sender)
    }

    if (await stepAntiLink(ctx, sock, msg))  return
    if (await stepMute(ctx, sock, msg))      return
    if (await stepAntiToxic(ctx, sock, msg)) return

    const textStr = extractText(msg) || ''
    const match   = matchPrefix(textStr, ctx.groupCfg)

    if (match && await stepGuards(ctx, sock, msg)) return

    await dispatch(ctx, sock, msg, match)

  } catch (err) {
    if (/Bad MAC|decrypt|session/i.test(err.message)) return
    logger.error('Pipeline', err.message)
  }
}