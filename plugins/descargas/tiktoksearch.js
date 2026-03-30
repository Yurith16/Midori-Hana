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
    return resultados.slice(0, 5) // Forzamos 5 videos máximo
  } catch (error) {
    throw new Error('API no responde oíste 🫢')
  }
}

export default {
  command: ['tiktoks', 'tks', 'tiktoksearch'],

  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) return 

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
      
      let enviados = 0
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        
        try {
          // Envío directo: Descarga y suelta
          await sock.sendMessage(from, {
            video: { url: video.videoUrl },
            mimetype: 'video/mp4',
            caption: `> 📝 ${video.description}\n> 👤 @${video.author}\n> 🍃 ${config.botName}`
          }, { quoted: msg })
          
          enviados++
          
          // Pausa de 2 segundos entre videos
          if (i < videos.length - 1) {
            await new Promise(r => setTimeout(r, 2000))
          }
        } catch (err) {
          console.log(`⏭️ Error en video ${i + 1}: ${err.message}`)
        }
      }
      
      if (enviados === 0) throw new Error('No pude enviar los videos')
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}