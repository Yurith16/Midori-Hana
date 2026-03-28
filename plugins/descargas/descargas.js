import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'

const AXIOS_DEFAULTS = {
  timeout: 60000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
  }
}

async function tryRequest(getter, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await getter()
    } catch (err) {
      lastError = err
      if (attempt < attempts) await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
  throw lastError
}

// EliteProTech API
async function getEliteProTechVideo(youtubeUrl) {
  const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS))
  if (res?.data?.success && res?.data?.downloadURL) {
    return { download: res.data.downloadURL, title: res.data.title }
  }
  throw new Error('EliteProTech falló')
}

// Yupra API
async function getYupraVideo(youtubeUrl) {
  const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS))
  if (res?.data?.success && res?.data?.data?.download_url) {
    return { download: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail }
  }
  throw new Error('Yupra falló')
}

// Okatsu API
async function getOkatsuVideo(youtubeUrl) {
  const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
  const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS))
  if (res?.data?.result?.mp4) {
    return { download: res.data.result.mp4, title: res.data.result.title }
  }
  throw new Error('Okatsu falló')
}

const activeUsers = new Map()

export default {
  command: ['test'],
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
      let searchQuery = args.join(' ')
      let videoUrl = searchQuery
      let videoTitle = ''
      let videoThumb = ''
      
      // Si no es URL, buscar en YouTube
      if (!searchQuery.match(/youtu/gi)) {
        await sock.sendMessage(from, { text: `> 🔍 Buscando...`, edit: processingMsg.key })
        
        const { videos } = await yts(searchQuery)
        if (!videos || videos.length === 0) throw new Error('No encontrado')
        
        videoUrl = videos[0].url
        videoTitle = videos[0].title
        videoThumb = videos[0].thumbnail
        
        // Enviar thumbnail
        if (videoThumb) {
          await sock.sendMessage(from, {
            image: { url: videoThumb },
            caption: `> 🎬 *${videoTitle}*\n> 📥 Descargando...`
          }, { quoted: msg })
        }
      }
      
      await sock.sendMessage(from, { text: `> 📥 Obteniendo video...`, edit: processingMsg.key })
      
      // Probar APIs en orden
      let videoData = null
      const apis = [
        { name: 'EliteProTech', method: () => getEliteProTechVideo(videoUrl) },
        { name: 'Yupra', method: () => getYupraVideo(videoUrl) },
        { name: 'Okatsu', method: () => getOkatsuVideo(videoUrl) }
      ]
      
      for (const api of apis) {
        try {
          videoData = await api.method()
          if (videoData?.download) {
            console.log(`✅ ${api.name} funcionó`)
            break
          }
        } catch (err) {
          console.log(`❌ ${api.name} falló: ${err.message}`)
        }
      }
      
      if (!videoData || !videoData.download) {
        throw new Error('No se pudo obtener el video')
      }
      
      const title = videoData.title || videoTitle || 'Video'
      const downloadUrl = videoData.download
      
      // Verificar tamaño
      const head = await axios.head(downloadUrl, { timeout: 10000 }).catch(() => null)
      const sizeMB = head?.headers?.['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024).toFixed(2) : '?'
      
      await sock.sendMessage(from, { text: `> 📤 Enviando video (${sizeMB}MB)...`, edit: processingMsg.key })
      
      await sock.sendMessage(from, {
        video: { url: downloadUrl },
        mimetype: 'video/mp4',
        fileName: `${title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp4`,
        caption: `> 🎬 *${title}*\n> 🍃 Descargado por Kari`
      }, { quoted: msg })
      
      await sock.sendMessage(from, { text: `> ✅ Video enviado`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ ${err.message || 'Error al descargar'}` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}