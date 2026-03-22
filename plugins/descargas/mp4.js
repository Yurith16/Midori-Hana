import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'

const activeUsers = new Map()

// Función para probar APIs en orden
const apis = [
  {
    name: 'EliteProTech',
    get: async (url) => {
      const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`, { timeout: 30000 })
      if (res.data?.success && res.data?.downloadURL) {
        return { download: res.data.downloadURL, title: res.data.title }
      }
      throw new Error('No disponible')
    }
  },
  {
    name: 'Yupra',
    get: async (url) => {
      const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 })
      if (res.data?.success && res.data?.data?.download_url) {
        return { download: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail }
      }
      throw new Error('No disponible')
    }
  },
  {
    name: 'Okatsu',
    get: async (url) => {
      const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 })
      if (res.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title }
      }
      throw new Error('No disponible')
    }
  }
]

export default {
  command: ['mp4', 'video'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una descarga en proceso' }, { quoted: msg })
      return
    }
    
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> ¿Qué video deseas descargar? 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> ⏳ Procesando...' }, { quoted: msg })
    
    try {
      let videoUrl = args[0]
      let finalUrl = videoUrl
      let videoTitle = ''
      
      // Si no es URL de YouTube, buscar
      if (!videoUrl.match(/youtu/gi)) {
        await sock.sendMessage(from, { text: `> 🔍 Buscando...`, edit: processingMsg.key })
        
        const search = await yts(args.join(' '))
        if (!search?.videos?.length) throw new Error('No encontrado')
        
        videoUrl = search.videos[0].url
        finalUrl = videoUrl
        videoTitle = search.videos[0].title
      }
      
      await sock.sendMessage(from, { text: `> 📥 Obteniendo video...`, edit: processingMsg.key })
      
      // Probar APIs en orden
      let result = null
      let usedApi = null
      
      for (const api of apis) {
        try {
          result = await api.get(videoUrl)
          usedApi = api.name
          console.log(`✅ ${usedApi} funcionó`)
          break
        } catch (err) {
          console.log(`❌ ${api.name} falló: ${err.message}`)
        }
      }
      
      if (!result || !result.download) {
        throw new Error('No se pudo obtener el video')
      }
      
      const title = result.title || videoTitle || 'YouTube Video'
      const downloadUrl = result.download
      
      // Verificar tamaño
      const head = await axios.head(downloadUrl, { timeout: 10000 }).catch(() => null)
      const sizeMB = head?.headers?.['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024).toFixed(2) : '?'
      
      if (parseInt(head?.headers?.['content-length']) > 400 * 1024 * 1024) {
        await sock.sendMessage(from, { text: `> ⚠️ Video demasiado grande (${sizeMB}MB). Límite 400MB`, edit: processingMsg.key })
        return
      }
      
      await sock.sendMessage(from, { text: `> 📤 Enviando video (${sizeMB}MB)...`, edit: processingMsg.key })
      
      await sock.sendMessage(from, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName: `${title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp4`,
        caption: `${finalUrl}`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: title,
            thumbnailUrl: result.thumbnail || '',
            sourceUrl: finalUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })
      
      await sock.sendMessage(from, { text: `> ✅ Video enviado`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ Error al descargar` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}