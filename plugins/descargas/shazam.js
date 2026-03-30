import { downloadMediaMessage } from '@whiskeysockets/baileys'
import axios from 'axios'
import FormData from 'form-data'
import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { fileURLToPath } from 'url'
import config from '../../config.js'
import { getAudio } from '../../utils/kar-api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'whatmusic')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeUsers = new Map()

function cleanup(files) {
  files.forEach(file => {
    try { if (file && fs.existsSync(file)) fs.unlinkSync(file) } catch {}
  })
}

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err) => (err ? reject(err) : resolve()))
  })
}

async function identifyMusic(audioPath) {
  const formData = new FormData()
  formData.append('media', fs.createReadStream(audioPath))
  
  try {
    const res = await axios.post('https://api.ananta.qzz.io/api/whatmusic', formData, {
      headers: { 'x-api-key': 'antebryxivz14', ...formData.getHeaders() },
      timeout: 60000
    })
    if (res.data?.success && res.data?.result) {
      return {
        title: res.data.result.title,
        artist: res.data.result.subtitle
      }
    }
  } catch (err) {
    const formData2 = new FormData()
    formData2.append('file', fs.createReadStream(audioPath))
    formData2.append('api_token', 'test')
    const res2 = await axios.post('https://api.audd.io/', formData2, { headers: formData2.getHeaders() })
    if (res2.data?.result) {
      return {
        title: res2.data.result.title,
        artist: res2.data.result.artist
      }
    }
  }
  throw new Error('No identificado')
}

export default {
  command: ['whatmusic', 'shazam', 'findmusic'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    if (activeUsers.has(userId)) return 
    
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted) {
      await sock.sendMessage(from, { text: '> 🎵 Responde a un audio o video para identificar oíste 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })
    
    let tempInput = null
    let tempAudio = null
    let convertedFile = null
    
    try {
      const buffer = await downloadMediaMessage({ message: quoted }, 'buffer', {}, { logger: console })
      if (!buffer) throw new Error('Error descarga')

      tempInput = path.join(TEMP_DIR, `${Date.now()}_input.tmp`)
      tempAudio = path.join(TEMP_DIR, `${Date.now()}.mp3`)
      fs.writeFileSync(tempInput, buffer)

      await execPromise(`"${ffmpegPath}" -i "${tempInput}" -acodec libmp3lame -ab 128k -ar 44100 -y "${tempAudio}" 2>/dev/null`)

      const result = await identifyMusic(tempAudio)
      const searchQuery = `${result.title} ${result.artist}`

      // 1. Buscar en YouTube
      const search = await yts(searchQuery)
      const video = search.videos.find(v => v.type === 'video') || search.videos[0]
      if (!video) throw new Error('No encontrado en YT')

      // 2. Enviar información con URL de YouTube
      const infoText = `> 🎵 *IDENTIFICADA*\n\n` +
        `> 🎤 *Título:* ${result.title}\n` +
        `> 👤 *Artista:* ${result.artist}\n` +
        `> 🔗 *YouTube:* ${video.url}\n\n` +
        `> 📥 *Enviando audio...*\n> 🍃 ${config.botName}`
      
      await sock.sendMessage(from, { text: infoText }, { quoted: msg })

      // 3. Descargar usando kar-api
      const downloadResult = await getAudio(video.url)
      if (!downloadResult || !downloadResult.url) throw new Error('API sin respuesta')

      let finalBuffer
      if (downloadResult.needsConversion) {
        const res = await fetch(downloadResult.url)
        const buff = Buffer.from(await res.arrayBuffer())
        const rawFile = path.join(TEMP_DIR, `${Date.now()}_raw.tmp`)
        fs.writeFileSync(rawFile, buff)
        
        convertedFile = path.join(TEMP_DIR, `${Date.now()}_final.mp3`)
        await execPromise(`"${ffmpegPath}" -i "${rawFile}" -acodec libmp3lame -ab 128k -ar 44100 -preset ultrafast "${convertedFile}" 2>/dev/null`)
        finalBuffer = fs.readFileSync(convertedFile)
        if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile)
      } else {
        const res = await fetch(downloadResult.url)
        finalBuffer = Buffer.from(await res.arrayBuffer())
      }

      // 4. Enviar el audio final con metadatos de YouTube
      const finalSizeMB = (finalBuffer.length / 1024 / 1024).toFixed(2)
      const cleanName = `${result.title.substring(0, 30)} - ${result.artist.substring(0, 20)}`

      const sentMsg = await sock.sendMessage(from, {
        audio: finalBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanName}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: result.title,
            body: `${video.timestamp} • ${finalSizeMB} MB • YouTube`,
            thumbnailUrl: downloadResult.thumb || video.thumbnail,
            sourceUrl: video.url,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error WhatMusic:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      cleanup([tempInput, tempAudio, convertedFile])
      activeUsers.delete(userId)
    }
  }
}