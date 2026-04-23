import axios from 'axios'

export default {
  command: ['img', 'imagen', 'buscarimg'],
  execute: async (sock, msg, { from, args }) => {
    // Validación estética
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué imagen desea buscar? 🍃' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/imagen/buscar', 
        { query: query }, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data || res.data.imagenes.length === 0) throw new Error()

      // Mezclamos y tomamos máximo 10 imágenes
      const imagenes = res.data.imagenes.sort(() => 0.5 - Math.random()).slice(0, 10)

      // Creamos el mensaje base del álbum
      const album = sock.generateWAMessageFromContent(from, {
        messageContextInfo: {},
        albumMessage: {
          expectedImageCount: imagenes.length,
          expectedVideoCount: 0,
          contextInfo: {
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe,
            stanzaId: msg.key.id,
            participant: msg.key.participant || msg.key.remoteJid,
            quotedMessage: msg.message,
          }
        }
      }, {})

      await sock.relayMessage(from, album.message, { messageId: album.key.id })

      // Enviamos cada imagen vinculada al álbum (sin caption)
      for (let i = 0; i < imagenes.length; i++) {
        const mediaMsg = await sock.generateWAMessage(from, {
          image: { url: imagenes[i] }
        }, { upload: sock.waUploadToServer })

        mediaMsg.message.messageContextInfo = {
          messageAssociation: { 
            associationType: 1, 
            parentMessageKey: album.key 
          }
        }

        await sock.relayMessage(from, mediaMsg.message, { messageId: mediaMsg.key.id })

        // Pequeño delay para evitar saturación
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}