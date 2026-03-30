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
  command: ['play', 'ytmp3'],
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
      let duration = '0:00'
      
      if (!videoUrl.match(/youtu/gi)) {
        // MEJORA: Buscamos específicamente videos que YouTube clasifica como música
        // y ordenamos los resultados para evitar tutoriales de barcos jaja
        const search = await yts(args.join(' '))
        
        // Buscamos el primer video que no sea un "Live" (en vivo) para evitar errores de stream
        const video = search.videos.find(v => v.type === 'video') || search.videos[0]
        
        if (!video) throw new Error('No encontrado')
        videoUrl = video.url
        videoTitle = video.title
        duration = video.timestamp
      }
      
      const result = await getAudio(videoUrl)
      if (!result || !result.url) throw new Error('API sin respuesta')

      const title = result.title || videoTitle
      const thumb = result.thumb || config.defaultImg
      const audioUrl = result.url
      const needsConversion = result.needsConversion || false
      
      let finalBuffer
      
      if (needsConversion) {
        tempFile = path.join(TEMP_DIR, `${Date.now()}.tmp`)
        const response = await fetch(audioUrl)
        const buffer = Buffer.from(await response.arrayBuffer())
        fs.writeFileSync(tempFile, buffer)
        
        convertedFile = path.join(TEMP_DIR, `${Date.now()}.mp3`)
        await execPromise(`"${ffmpegPath}" -i "${tempFile}" -acodec libmp3lame -ab 128k -ar 44100 -preset ultrafast "${convertedFile}" 2>/dev/null`)
        
        finalBuffer = fs.readFileSync(convertedFile)
      } else {
        const response = await fetch(audioUrl)
        finalBuffer = Buffer.from(await response.arrayBuffer())
      }

      const finalSizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2)
      const cleanName = `${title.substring(0, 30).replace(/[<>:"/\\|?*]/g, '')} - ${config.botName}`

      const sentMsg = await sock.sendMessage(from, {
        audio: finalBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanName}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: `🎵 ${title}`,
            body: `${duration} • ${finalSizeMB} MB • YouTube`,
            thumbnailUrl: thumb,
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error('Error en Play:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (convertedFile && fs.existsSync(convertedFile)) fs.unlinkSync(convertedFile)
    }
  }
}