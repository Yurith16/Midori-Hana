import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
  command: ['setfoto'],
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

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const isImage = quoted?.imageMessage || msg.message?.imageMessage

    if (!isImage) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Responde a una imagen para cambiar la foto del grupo 🍃' }, { quoted: msg })
      return
    }

    try {
      // Construir el mensaje correcto para downloadMediaMessage
      const msgToDownload = quoted
        ? { key: msg.key, message: { imageMessage: quoted.imageMessage } }
        : msg

      const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {})

      await sock.updateProfilePicture(from, buffer)

      await sock.sendMessage(from, { text: '> Foto del grupo actualizada 🍃' }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo actualizar la foto del grupo 🍃' }, { quoted: msg })
    }
  }
}