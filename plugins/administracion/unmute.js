import { getRealJid } from '../../utils/jid.js'
import { setMute } from '../../database/db.js'
import { setSubbotMute } from '../../database/db-subbot.js'

export default {
  command: ['unmute', 'hablar'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner, subbotNumero }) {
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
      await sock.sendMessage(from, { text: '*Etiqueta a quien quieres devolverle la voz 🍃*' }, { quoted: msg })
      return
    }

    let targetJid = targetRaw
    try { targetJid = await getRealJid(sock, targetRaw, msg) } catch {}

    const isSubbot = !!subbotNumero

    if (isSubbot) {
      await setSubbotMute(subbotNumero, from, targetJid, false)
    } else {
      setMute(from, targetJid, false)
    }

    await sock.sendMessage(from, { react: { text: '🔊', key: msg.key } })
    await sock.sendMessage(from, { 
      text: `🍃 El usuario @${targetRaw.split('@')[0]} ya puede hablar de nuevo 🎤`,
      mentions: [targetRaw]
    }, { quoted: msg })
  }
}