import axios from 'axios'

const activeUsers = new Map()

async function pinterestSearch(query) {
  try {
    const response = await axios.post('https://panel.apinexus.fun/api/pinterest/buscar', 
      { query: query },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'antbx21e5jhac'
        },
        timeout: 20000
      }
    )

    if (!response.data?.success || !response.data?.data?.imagenes) {
      throw new Error('Sin resultados')
    }

    const imagenes = response.data.data.imagenes.slice(0, 5)
    
    if (!imagenes.length) throw new Error('Sin resultados válidos')
    
    return imagenes.map(url => ({ imageUrl: url }))

  } catch (error) {
    throw new Error('No se pudo obtener resultados')
  }
}

export default {
  command: ['pinterest', 'pin', 'pins'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from

    if (activeUsers.has(userId)) return

    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en Pinterest? 🍃' }, { quoted: msg })
      return
    }

    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      const query = args.join(' ')
      const imagenes = await pinterestSearch(query)

      if (!imagenes.length) throw new Error('Sin resultados')

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

      for (let i = 0; i < imagenes.length; i++) {
        const img = imagenes[i]
        const mediaMsg = await sock.generateWAMessage(from, {
          image: { url: img.imageUrl },
          caption: i === 0 ? `> Aquí tiene su pedido @${userId.split('@')[0]} 🍃` : '',
          ...(i === 0 ? { mentions: [userId] } : {})
        }, { upload: sock.waUploadToServer })

        mediaMsg.message.messageContextInfo = {
          messageAssociation: { associationType: 1, parentMessageKey: album.key }
        }

        await sock.relayMessage(from, mediaMsg.message, { messageId: mediaMsg.key.id })
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se encontraron imágenes para esa búsqueda 🍃' }, { quoted: msg })
    } finally {
      activeUsers.delete(userId)
    }
  }
}