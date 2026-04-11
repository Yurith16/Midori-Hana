export default {
  command: ['promote', 'promover'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Verificar si el usuario es admin
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
      return
    }

    // Obtener el usuario objetivo: por @tag o por mensaje citado
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant

    let targetUser = null

    if (mentioned && mentioned.length > 0) {
      targetUser = mentioned[0]
    } else if (quotedParticipant) {
      targetUser = quotedParticipant
    }

    if (!targetUser) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Etiqueta o responde al mensaje del usuario para promover a admin 🍃' }, { quoted: msg })
      return
    }

    // Evitar promover a alguien que ya es admin
    const isAlreadyAdmin = metadata.participants.find(p => p.id === targetUser)?.admin
    if (isAlreadyAdmin) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Este usuario ya es administrador 🍃' }, { quoted: msg })
      return
    }

    try {
      await sock.groupParticipantsUpdate(from, [targetUser], 'promote')

      await sock.sendMessage(from, {
        text: `> @${targetUser.split('@')[0]} ha sido promovido a administrador por @${sender.split('@')[0]} 🍃`,
        mentions: [targetUser, sender]
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo promover al usuario 🍃' }, { quoted: msg })
    }
  }
}