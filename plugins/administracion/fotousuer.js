export default {
  command: ['foto', 'pfp', 'perfil'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, isGroup }) {
    try {
      let targetJid

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo
      const mentioned = contextInfo?.mentionedJid?.[0]
      const quotedParticipant = contextInfo?.participant

      if (mentioned) {
        targetJid = mentioned
      } else if (quotedParticipant) {
        targetJid = quotedParticipant
      } else if (args[0]) {
        let num = args[0].replace(/\D/g, '')
        if (num.length >= 10) {
          targetJid = `${num}@s.whatsapp.net`
        } else {
          await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
          await sock.sendMessage(from, { text: '> Número inválido 🍃' }, { quoted: msg })
          return
        }
      } else {
        if (isGroup) {
          targetJid = msg.key.participant || msg.key.remoteJid
        } else {
          const participants = [msg.key.remoteJid, sock.user.id]
          targetJid = participants.find(jid => jid !== sock.user.id) || msg.key.remoteJid
        }
      }

      await sock.sendMessage(from, { react: { text: '📸', key: msg.key } })

      const url = await sock.profilePictureUrl(targetJid, 'image')

      await sock.sendMessage(from, {
        image: { url },
        caption: `> 📷 @${targetJid.split('@')[0]}`,
        mentions: [targetJid]
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo obtener la foto 🍃' }, { quoted: msg })
    }
  }
}