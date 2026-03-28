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
      await sock.sendMessage(from, { text: '> ¿Qué música deseas descargar? 🍃' }, { quoted: msg })
      return
    }
    
    await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> ⏳ Procesando...' }, { quoted: msg })
    
    let tempFile = null
    let convertedFile = null
    
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
      
      await sock.sendMessage(from, { text: `> 📥 Obteniendo audio...`, edit: processingMsg.key })
      
      // Obtener audio de las APIs
      const result = await getAudio(videoUrl)
      
      const title = result.title || videoTitle
      const thumb = result.thumb
      const audioUrl = result.url
      const needsConversion = result.needsConversion || false
      
      let finalBuffer
      let finalSizeMB
      
      if (needsConversion) {
        // FG-Senna: descargar y convertir
        tempFile = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`)
        const response = await fetch(audioUrl)
        const buffer = Buffer.from(await response.arrayBuffer())
        fs.writeFileSync(tempFile, buffer)
        
        await sock.sendMessage(from, { text: `> 🔄 Convirtiendo a MP3...`, edit: processingMsg.key })
        
        convertedFile = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`)
        await execPromise(`"${ffmpegPath}" -i "${tempFile}" -acodec libmp3lame -ab 128k -ar 44100 -preset ultrafast "${convertedFile}" 2>/dev/null`)
        
        if (!fs.existsSync(convertedFile)) throw new Error('Error en conversión')
        
        finalBuffer = fs.readFileSync(convertedFile)
        finalSizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2)
      } else {
        // Otras APIs: descargar directamente
        const response = await fetch(audioUrl)
        finalBuffer = Buffer.from(await response.arrayBuffer())
        finalSizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2)
      }
      
      await sock.sendMessage(from, { text: `> 📤 Enviando audio (${finalSizeMB}MB)...`, edit: processingMsg.key })
      
      await sock.sendMessage(from, {
        document: finalBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp3`,
        caption: `${finalUrl}`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: title,
            thumbnailUrl: thumb || 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: finalUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })
      
      await sock.sendMessage(from, { text: `> ✅ Audio enviado`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ Error al descargar` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (convertedFile && fs.existsSync(convertedFile)) fs.unlinkSync(convertedFile)
    }
  }
}