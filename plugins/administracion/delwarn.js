import { getRealJid } from '../../utils/jid.js'
import { delWarn, getWarnEntry } from '../../database/db.js'
import { getSubbotGroupConfig, updateSubbotGroupConfig } from '../../database/db-subbot.js'

const MAX_WARNS = 3

function getWarnEntryFromCfg(cfg, targetJid) {
  const id = targetJid.split('@')[0].replace(/\D/g, '')
  return cfg.warns?.[id] || { count: 0, name: '' }
}

function delWarnFromCfg(cfg, targetJid) {
  const id = targetJid.split('@')[0].replace(/\D/g, '')
  if (cfg.warns?.[id]) {
    cfg.warns[id].count = Math.max(0, cfg.warns[id].count - 1)
    if (cfg.warns[id].count === 0) delete cfg.warns[id]
  }
}

export default {
  command: ['delwarn', 'quitarwarn'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner, subbotNumero }) {
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender) && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '*Solo los administradores pueden perdonar faltas 🍃*' }, { quoted: msg })
      return
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = contextInfo?.mentionedJid
    const quotedParticipant = contextInfo?.participant
    let targetRaw = mentioned?.[0] || quotedParticipant

    if (!targetRaw) {
      await sock.sendMessage(from, { react: { text: '❔', key: msg.key } })
      await sock.sendMessage(from, { text: '*Debes decirme a quién le quitaremos la falta 🍃*' }, { quoted: msg })
      return
    }

    let targetJid = targetRaw
    try { targetJid = await getRealJid(sock, targetRaw, msg) } catch {}

    const isSubbot = !!subbotNumero
    let entry

    if (isSubbot) {
      const cfg = await getSubbotGroupConfig(subbotNumero, from)
      entry = getWarnEntryFromCfg(cfg, targetJid)
    } else {
      entry = getWarnEntry(from, targetJid)
    }

    if (!entry.count || entry.count === 0) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, {
        text: `@${targetRaw.split('@')[0]} ya está libre de culpas 🍃`,
        mentions: [targetRaw]
      }, { quoted: msg })
      return
    }

    // Eliminar warn según corresponda
    if (isSubbot) {
      const cfg = await getSubbotGroupConfig(subbotNumero, from)
      delWarnFromCfg(cfg, targetJid)
      await updateSubbotGroupConfig(subbotNumero, from, { warns: cfg.warns })
      const newCount = Math.max(0, entry.count - 1)
      await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })
      await sock.sendMessage(from, {
        text: `Advertencias removidas para @${targetRaw.split('@')[0]} 🍃 ${newCount}/${MAX_WARNS}`,
        mentions: [targetRaw]
      }, { quoted: msg })
    } else {
      delWarn(from, targetJid)
      const newCount = Math.max(0, entry.count - 1)
      await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })
      await sock.sendMessage(from, {
        text: `Advertencias removidas para @${targetRaw.split('@')[0]} 🍃 ${newCount}/${MAX_WARNS}`,
        mentions: [targetRaw]
      }, { quoted: msg })
    }
  }
}