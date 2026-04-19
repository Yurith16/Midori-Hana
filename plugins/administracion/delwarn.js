import { getRealJid } from '../../utils/jid.js'
import { delWarn, getWarnEntry } from '../../database/db.js'

const MAX_WARNS = 3

export default {
  command: ['delwarn', 'quitarwarn'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
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

    const entry = getWarnEntry(from, targetJid)

    if (!entry.count || entry.count === 0) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, {
        text: `@${targetRaw.split('@')[0]} ya está libre de culpas 🍃`,
        mentions: [targetRaw]
      }, { quoted: msg })
      return
    }

    delWarn(from, targetJid)
    const newCount = Math.max(0, entry.count - 1)

    // Reacción de éxito
    await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })

    await sock.sendMessage(from, {
      text: `Advertencias removidas para @${targetRaw.split('@')[0]} 🍃 ${newCount}/${MAX_WARNS}`,
      mentions: [targetRaw]
    }, { quoted: msg })
  }
}