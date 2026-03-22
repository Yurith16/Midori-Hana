import yts from 'yt-search'
import config from '../../config.js'

const activeUsers = new Map()

export default {
  command: ['yts', 'ytsearch', 'buscar'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una búsqueda en proceso' }, { quoted: msg })
      return
    }
    
       if (!args[0]) {
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en YouTube? 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> 🔍 Buscando...' }, { quoted: msg })
    
    try {
      const query = args.join(' ')
      const results = await yts(query)
      
      if (!results?.videos?.length) {
        await sock.sendMessage(from, { text: '> ❌ No se encontraron resultados', edit: processingMsg.key })
        return
      }
      
      const videos = results.videos.slice(0, 5)
      
      await sock.sendMessage(from, { text: '> 📥 Enviando resultados...', edit: processingMsg.key })
      
      for (const video of videos) {
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
        } catch (err) {
          console.log(`Error enviando video: ${err.message}`)
        }
      }
      
      await sock.sendMessage(from, { text: '> ✅ Resultados enviados', edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '> ❌ Error en la búsqueda', edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}