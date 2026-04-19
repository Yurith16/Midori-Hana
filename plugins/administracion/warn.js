import { getRealJid } from '../../utils/jid.js'
import { addWarn, resetWarns } from '../../database/db.js'

const MAX_WARNS = 3

export default {
  command: ['warn', 'advertir'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender) && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '*Solo los admins pueden usar este poder 🍃*' }, { quoted: msg })
      return
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = contextInfo?.mentionedJid
    const quotedParticipant = contextInfo?.participant
    let targetRaw = mentioned?.[0] || quotedParticipant

    if (!targetRaw) {
      await sock.sendMessage(from, { react: { text: '❔', key: msg.key } })
      await sock.sendMessage(from, { text: '*Debes etiquetar o responder a alguien para advertirle 🍃*' }, { quoted: msg })
      return
    }

    let targetJid = targetRaw
    try { targetJid = await getRealJid(sock, targetRaw, msg) } catch {}

    if (groupAdmins.includes(targetRaw)) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, { text: '*No puedo advertir a un administrador 🍃*' }, { quoted: msg })
      return
    }

    let userName = contextInfo?.pushName || 'Usuario de Midori-Hana'
    const count = addWarn(from, targetJid, userName)

    const numeral = count === 1 ? 'Primera' : count === 2 ? 'Segunda' : 'Tercera'

    // Reacción de advertencia
    await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })

    await sock.sendMessage(from, {
      text: `${numeral} advertencia aplicada a @${targetRaw.split('@')[0]} 🍃 ${count}/${MAX_WARNS}`,
      mentions: [targetRaw]
    }, { quoted: msg })

    if (count >= MAX_WARNS) {
      await sock.sendMessage(from, {
        text: `Lo lamento @${targetRaw.split('@')[0]} pero alcanzaste el limite de advertencias, en 5 segundos seras eliminado, byee 🍃`,
        mentions: [targetRaw]
      }, { quoted: msg })

      await new Promise(r => setTimeout(r, 5000))

      try {
        await sock.groupParticipantsUpdate(from, [targetRaw], 'remove')
        resetWarns(from, targetJid)
        await sock.sendMessage(from, { react: { text: '👋', key: msg.key } })
      } catch {
        await sock.sendMessage(from, { text: '*No tengo permisos para eliminar a este usuario 🍃*' })
      }
    }
  }
}