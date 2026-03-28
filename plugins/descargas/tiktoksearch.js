import axios from 'axios'
import config from '../../config.js'

const activeUsers = new Map()

async function tiktokSearch(query) {
  try {
    const response = await axios.post("https://tikwm.com/api/feed/search",
      new URLSearchParams({
        keywords: query,
        count: '15',
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
    return resultados.slice(0, 10)
  } catch (error) {
    throw new Error('API no responde')
  }
}

export default {
  command: ['tiktoks', 'tks', 'tiktoksearch'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una búsqueda en proceso' }, { quoted: msg })
      return
    }
    
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en TikTok? 🍃\n\n> Ejemplo: .tiktoks memes' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> 🔍 Buscando...' }, { quoted: msg })
    
    try {
      const query = args.join(' ')
      const videos = await tiktokSearch(query)
      
      if (videos.length < 2) {
        throw new Error('No encontré suficientes videos')
      }
      
      await sock.sendMessage(from, { text: `> 📥 Enviando ${videos.length} videos...`, edit: processingMsg.key })
      
      let enviados = 0
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        const num = i + 1
        
        try {
          // Verificar tamaño del video
          const head = await axios.head(video.videoUrl, { timeout: 10000 }).catch(() => null)
          const sizeMB = head?.headers?.['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024) : 0
          
          if (sizeMB > 200) {
            console.log(`⏭️ Video ${num} excede 200MB (${sizeMB.toFixed(2)}MB), omitiendo`)
            continue
          }
          
          await sock.sendMessage(from, {
            video: { url: video.videoUrl },
            mimetype: 'video/mp4',
            caption: `> 🎵 *TikTok ${num}/10*\n> 📝 ${video.description}\n> 👤 @${video.author}\n> 🍃 Descargado por ${config.botName}`,
            contextInfo: {
              externalAdReply: {
                title: `🍃 ${config.botName}`,
                body: video.description.substring(0, 50),
                thumbnailUrl: 'https://i.imgur.com/8g9QRs6.png',
                mediaType: 1,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: msg })
          
          enviados++
          
          // Pausa entre videos para evitar saturar
          if (i < videos.length - 1) {
            await new Promise(r => setTimeout(r, 1500))
          }
        } catch (err) {
          console.log(`⏭️ Error enviando video ${num}: ${err.message}`)
        }
      }
      
      if (enviados === 0) {
        throw new Error('No se pudieron enviar videos')
      }
      
      await sock.sendMessage(from, { text: `> ✅ ${enviados} videos enviados`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ ${err.message || 'Error en la búsqueda'}` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}