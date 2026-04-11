export default {
  command: ['admins'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    try {
      const metadata = await sock.groupMetadata(from)

      const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin')

      if (!admins.length) {
        await sock.sendMessage(from, { text: '> Este grupo no tiene administradores 🍃' }, { quoted: msg })
        return
      }

      const adminIds = admins.map(p => p.id)
      const lista = admins.map(p => `@${p.id.split('@')[0]}`).join('\n')

      await sock.sendMessage(from, {
        text: `> *Administradores de ${metadata.subject}* 🍃\n\n${lista}`,
        mentions: adminIds
      }, { quoted: msg })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo obtener la lista de admins 🍃' }, { quoted: msg })
    }
  }
}