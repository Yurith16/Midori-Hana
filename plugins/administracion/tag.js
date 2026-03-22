export default {
  command: ['tag', 'tagall', 'invocar', 'marcar'],
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

    await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })

    try {
      // Obtener participantes del grupo
      const participants = metadata.participants.map(p => p.id)
      
      const texto = args.length ? args.join(' ') : '¡Atención aquí, tesoros! 💋'
      
      // Obtener mensaje citado si existe
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      let media = null
      let isMedia = false
      
      if (quoted) {
        if (quoted.imageMessage) {
          media = quoted.imageMessage
          isMedia = true
        } else if (quoted.videoMessage) {
          media = quoted.videoMessage
          isMedia = true
        } else if (quoted.stickerMessage) {
          media = quoted.stickerMessage
          isMedia = true
        } else if (quoted.audioMessage) {
          media = quoted.audioMessage
          isMedia = true
        }
      }
      
      if (isMedia && media) {
        // Descargar media
        const buffer = await sock.downloadMediaMessage({
          key: msg.message.extendedTextMessage.contextInfo,
          message: quoted
        })
        
        if (quoted.audioMessage) {
          await sock.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            fileName: 'tag.mp3',
            mentions: participants,
            contextInfo: { mentionedJid: participants }
          }, { quoted: msg })
        } else if (quoted.stickerMessage) {
          await sock.sendMessage(from, {
            sticker: buffer,
            mentions: participants,
            contextInfo: { mentionedJid: participants }
          }, { quoted: msg })
        } else if (quoted.imageMessage) {
          await sock.sendMessage(from, {
            image: buffer,
            caption: texto,
            mentions: participants,
            contextInfo: { mentionedJid: participants }
          }, { quoted: msg })
        } else if (quoted.videoMessage) {
          await sock.sendMessage(from, {
            video: buffer,
            caption: texto,
            mentions: participants,
            contextInfo: { mentionedJid: participants }
          }, { quoted: msg })
        }
      } else {
        // Solo texto con menciones
        await sock.sendMessage(from, {
          text: texto,
          mentions: participants,
          contextInfo: { mentionedJid: participants }
        }, { quoted: msg })
      }
      
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '> ❌ Error al invocar a los usuarios' }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}