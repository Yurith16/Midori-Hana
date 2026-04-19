import { getRealJid } from '../../utils/jid.js'
import { setMute } from '../../database/db.js'

export default {
  command: ['mute', 'silenciar'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender) && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      return
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetRaw = contextInfo?.mentionedJid?.[0] || contextInfo?.participant

    if (!targetRaw) {
      await sock.sendMessage(from, { react: { text: '❔', key: msg.key } })
      await sock.sendMessage(from, { text: '*Etiqueta o responde a alguien para silenciarlo 🍃*' }, { quoted: msg })
      return
    }

    let targetJid = targetRaw
    try { targetJid = await getRealJid(sock, targetRaw, msg) } catch {}

    if (groupAdmins.includes(targetRaw)) {
      await sock.sendMessage(from, { text: '*No puedo silenciar a un administrador 🍃*' }, { quoted: msg })
      return
    }

    setMute(from, targetJid, true)
    await sock.sendMessage(from, { react: { text: '🔇', key: msg.key } })
    await sock.sendMessage(from, { 
      text: `El usuario @${targetRaw.split('@')[0]} ha sido silenciado. Sus mensajes serán eliminados 🍃`,
      mentions: [targetRaw]
    }, { quoted: msg })
  }
}