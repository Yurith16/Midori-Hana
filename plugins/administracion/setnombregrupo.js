export default {
  command: ['setnombre', 'setnome', 'renombrar'],
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
      await sock.sendMessage(from, { text: '> Escribe el nuevo nombre del grupo 🍃' }, { quoted: msg })
      return
    }

    const nuevoNombre = args.join(' ')

    if (nuevoNombre.length > 25) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> El nombre no puede tener más de 25 caracteres 🍃' }, { quoted: msg })
      return
    }

    try {
      await sock.groupUpdateSubject(from, nuevoNombre)

      await sock.sendMessage(from, { text: `> El grupo ahora se llama *${nuevoNombre}* 🍃` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo cambiar el nombre del grupo 🍃' }, { quoted: msg })
    }
  }
}