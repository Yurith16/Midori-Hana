import yts from 'yt-search'
import config from '../../config.js'

const activeUsers = new Map()

export default {
  command: ['yts', 'ytsearch', 'buscar'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) return 

    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en YouTube? 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })
    
    try {
      const query = args.join(' ')
      const results = await yts(query)
      
      if (!results?.videos?.length) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        await sock.sendMessage(from, { text: '> No encontré nada oíste 🫢' }, { quoted: msg })
        return
      }
      
      // Tomamos los primeros 5 resultados
      const videos = results.videos.slice(0, 5)
      
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        const { title, author, duration, views, ago, url, thumbnail } = video
        
        const videoDetails = `> 🎵 *「🌱」 ${title}*\n\n` +
          `> 🍃 *Canal:* » ${author.name}\n` +
          `> ⚘ *Duración:* » ${duration.timestamp}\n` +
          `> 🌼 *Vistas:* » ${(views || 0).toLocaleString()}\n` +
          `> 🍀 *Publicado:* » ${ago || 'Reciente'}\n` +
          `> 🌿 *Enlace:* » ${url}`
        
        try {
          await sock.sendMessage(from, {
            image: { url: thumbnail },
            caption: videoDetails
          }, { quoted: msg })

          // Pausa de 1.5 segundos entre imágenes para no saturar el chat
          if (i < videos.length - 1) {
            await new Promise(r => setTimeout(r, 1500))
          }
        } catch (err) {
          console.log(`Error enviando video: ${err.message}`)
        }
      }
      
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error('Error YTS:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}