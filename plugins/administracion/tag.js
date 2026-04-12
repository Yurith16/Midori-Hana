export default {
  command: ['tag'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Verificar si el usuario es admin
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { text: '> 🚫 No tienes permisos para usar este comando' }, { quoted: msg })
      return
    }

    try {
      // Obtener todos los participantes del grupo
      const participants = metadata.participants.map(p => p.id)

      const texto = args.length ? args.join(' ') : '📢 Atención'

      // Etiquetar a todos de forma silenciosa (sin @menciones visibles en el texto)
      await sock.sendMessage(from, {
        text: texto,
        mentions: participants
      }, { quoted: msg })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '> ⚠️ Error al enviar el mensaje' }, { quoted: msg })
    }
  }
}