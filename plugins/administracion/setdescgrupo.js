export default {
  command: ['setdesc', 'descripcion', 'setdescripcion'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
      return
    }

    if (!args.length) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Escribe la nueva descripción del grupo 🍃' }, { quoted: msg })
      return
    }

    const nuevaDesc = args.join(' ')

    try {
      await sock.groupUpdateDescription(from, nuevaDesc)

      await sock.sendMessage(from, { text: '> Descripción del grupo actualizada 🍃' }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo actualizar la descripción 🍃' }, { quoted: msg })
    }
  }
}