import axios from 'axios'
import config from '../../config.js'

const activeUsers = new Map()

async function tiktokSearch(query) {
  try {
    const response = await axios.post("https://tikwm.com/api/feed/search",
      new URLSearchParams({
        keywords: query,
        count: '10',
        cursor: '0',
        HD: '1'
      }), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 20000
    })

    const videos = response.data?.data?.videos || []
    if (videos.length === 0) throw new Error('No se encontraron videos')

    const resultados = []
    for (const v of videos) {
      const videoUrl = v.play || v.wmplay || v.hdplay || null
      if (videoUrl) {
        resultados.push({
          description: v.title ? v.title.slice(0, 100) : "Video de TikTok",
          videoUrl: videoUrl,
          author: v.author?.nickname || "Usuario"
        })
      }
    }
    return resultados.slice(0, 5)
  } catch (error) {
    throw new Error('API no responde')
  }
}

export default {
  command: ['tiktoks', 'tks', 'tiktoksearch'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      return
    }
    
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en TikTok? 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    
    try {
      const query = args.join(' ')
      const videos = await tiktokSearch(query)
      
      if (!videos.length) throw new Error('No encontrado')
      
      const medias = videos.map(v => ({
        type: 'video',
        data: { url: v.videoUrl },
        caption: `> 📝 ${v.description}\n> 👤 @${v.author}\n> 🍃 ${config.botName}`
      }))

      const caption = `> 🔍 *BÚSQUEDA:* ${query}\n> 📹 *CANTIDAD:* ${medias.length}\n\n> 🍃 ${config.botName}`

      // Crear mensaje de álbum
      const album = await sock.generateWAMessageFromContent(from, {
        messageContextInfo: {},
        albumMessage: {
          expectedImageCount: medias.length,
          expectedVideoCount: medias.length,
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

      for (let i = 0; i < medias.length; i++) {
        const { type, data, caption: videoCaption } = medias[i]
        const mediaMsg = await sock.generateWAMessage(from, {
          [type]: data,
          ...(i === 0 ? { caption } : { caption: videoCaption })
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
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}