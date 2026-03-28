import fs from 'fs'
import path from 'path'
import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'
import { getVideo } from '../../utils/video-api.js'

const activeUsers = new Map()
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'video')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
  command: ['play2', 'ytmp4', 'ytv'],
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
    const processingMsg = await sock.sendMessage(from, { text: '> ⏳ Procesando pedido 🙂‍↕️' }, { quoted: msg })
    
    let tempFile = null
    
    try {
      let videoUrl = args[0]
      let finalUrl = videoUrl
      
      // Si no es URL de YouTube, buscar
      if (!videoUrl.match(/youtu/gi)) {
        await sock.sendMessage(from, { text: `> 🔍 Buscando...`, edit: processingMsg.key })
        
        const search = await yts(args.join(' '))
        if (!search?.videos?.length) throw new Error('No encontrado')
        
        videoUrl = search.videos[0].url
        finalUrl = videoUrl
      }
      
      await sock.sendMessage(from, { text: `> 📥 Descargando... espere 🙂‍↔️`, edit: processingMsg.key })
      
      const result = await getVideo(videoUrl)
      
      let videoBuffer
      let sizeMB
      
      if (result.needsDownload) {
        // FG-Senna: descargar localmente
        const response = await fetch(result.url)
        videoBuffer = Buffer.from(await response.arrayBuffer())
        sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2)
      } else {
        // Otras APIs: verificar tamaño con HEAD
        try {
          const head = await axios.head(result.url, { timeout: 10000 })
          sizeMB = head.headers['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024).toFixed(2) : '?'
        } catch (headErr) {
          sizeMB = '?'
        }
        videoBuffer = null
      }
      
      const sizeNum = parseFloat(sizeMB)
      if (!isNaN(sizeNum) && sizeNum > 400) {
        await sock.sendMessage(from, { text: `> ⚠️ Video demasiado grande (${sizeMB}MB). Límite 400MB`, edit: processingMsg.key })
        return
      }
      
      await sock.sendMessage(from, { text: `> 📤 Enviando su pedido (${sizeMB}MB) 🫣`, edit: processingMsg.key })
      
      const sentMsg = await sock.sendMessage(from, {
        document: result.needsDownload ? videoBuffer : { url: result.url },
        mimetype: 'video/mp4',
        fileName: `${result.title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp4`,
        caption: `${finalUrl}`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: `${result.title} • ${sizeMB}MB`,
            thumbnailUrl: result.thumb || 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: finalUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })
      
      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      }
      
      await sock.sendMessage(from, { text: `> ✅ Video enviado`, edit: processingMsg.key })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ Error al descargar` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      activeUsers.delete(userId)
    }
  }
}