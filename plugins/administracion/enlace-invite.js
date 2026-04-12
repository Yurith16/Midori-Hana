export default {
  command: ['enlace', 'link', 'invite'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
      return
    }

    try {
      const code = await sock.groupInviteCode(from)

      await sock.sendMessage(from, {
        text: `> 🔗 *Enlace de ${metadata.subject}* 🍃\n\nhttps://chat.whatsapp.com/${code}`
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo obtener el enlace del grupo 🍃' }, { quoted: msg })
    }
  }
}