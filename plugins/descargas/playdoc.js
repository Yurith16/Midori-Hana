import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import yts from 'yt-search'
import config from '../../config.js'
import { getAudio } from '../../utils/kar-api.js'

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'audio')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()))
  })
}

export default {
  command: ['playdoc', 'ytmp3doc'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Ups!! Olvidaste colocar el nombre bb 🤭' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    
    let tempFile = null
    let convertedFile = null
    
    try {
      let videoUrl = args[0]
      let videoTitle = ''
      let ytThumb = '' // Variable para la miniatura real
      
      // Lógica de búsqueda e imagen
      if (!videoUrl.match(/youtu/gi)) {
        const search = await yts(args.join(' '))
        const video = search.videos.find(v => v.type === 'video') || search.videos[0]
        
        if (!video) throw new Error('No encontrado')
        videoUrl = video.url
        videoTitle = video.title
        ytThumb = video.thumbnail || video.image
      } else {
        // Si es link, extraemos el ID para buscar su miniatura real
        const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop()
        const search = await yts({ videoId })
        ytThumb = search.thumbnail || search.image
        videoTitle = search.title
      }
      
      const result = await getAudio(videoUrl)
      if (!result || !result.url) throw new Error('API sin respuesta')

      const title = result.title || videoTitle
      // Prioridad a la imagen de YouTube
      const thumb = ytThumb || result.thumb || config.defaultImg
      const audioUrl = result.url
      const needsConversion = result.needsConversion || false
      
      let finalBuffer
      
      if (needsConversion) {
        tempFile = path.join(TEMP_DIR, `${Date.now()}.tmp`)
        const response = await fetch(audioUrl)
        if (!response.ok) throw new Error('Fallo descarga temporal')
        
        const buffer = Buffer.from(await response.arrayBuffer())
        fs.writeFileSync(tempFile, buffer)
        
        convertedFile = path.join(TEMP_DIR, `${Date.now()}.mp3`)
        await execPromise(`"${ffmpegPath}" -i "${tempFile}" -acodec libmp3lame -ab 128k -ar 44100 -preset ultrafast "${convertedFile}" 2>/dev/null`)
        
        if (!fs.existsSync(convertedFile)) throw new Error('Error en conversión')
        finalBuffer = fs.readFileSync(convertedFile)
      } else {
        const response = await fetch(audioUrl)
        if (!response.ok) throw new Error('Fallo descarga directa')
        finalBuffer = Buffer.from(await response.arrayBuffer())
      }

      const cleanName = `${title.substring(0, 30).replace(/[<>:"/\\|?*]/g, '')} - ${config.botName}`

      // Envío como DOCUMENTO
      const sentMsg = await sock.sendMessage(from, {
        document: finalBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanName}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: title,
            thumbnailUrl: thumb, // Imagen corregida aquí
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error('Error en PlayDoc:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (convertedFile && fs.existsSync(convertedFile)) fs.unlinkSync(convertedFile)
    }
  }
}