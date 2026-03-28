import axios from 'axios'
import FormData from 'form-data'
import yts from 'yt-search'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import config from '../../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'whatmusic')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeUsers = new Map()

function tempName() {
  return `whatmusic_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function cleanup(files) {
  files.forEach(file => {
    try { if (fs.existsSync(file)) fs.unlinkSync(file) } catch {}
  })
}

function execPromise(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args)
    let error = ''
    proc.stderr?.on('data', (data) => error += data)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Error: ${error}`))
    })
    proc.on('error', reject)
  })
}

async function convertToMp3(inputPath, outputPath) {
  await execPromise('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', inputPath, '-vn',
    '-c:a', 'libmp3lame', '-b:a', '128k',
    '-ar', '44100', '-ac', '2', '-y', outputPath
  ])
  return outputPath
}

async function compressAudio(inputPath, outputPath) {
  await execPromise('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', inputPath,
    '-c:a', 'libmp3lame', '-b:a', '64k',
    '-ar', '22050', '-y', outputPath
  ])
  return outputPath
}

async function identifyWithAnanta(audioPath) {
  const formData = new FormData()
  formData.append('media', fs.createReadStream(audioPath))

  const res = await axios.post('https://api.ananta.qzz.io/api/whatmusic', formData, {
    headers: { 'x-api-key': 'antebryxivz14', ...formData.getHeaders() },
    timeout: 90000
  })

  if (res.data?.success && res.data?.result) {
    return {
      title: res.data.result.title,
      artist: res.data.result.subtitle,
      youtube: res.data.result.youtube
    }
  }
  throw new Error('Ananta falló')
}

async function identifyWithAudD(audioPath) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(audioPath))
  formData.append('api_token', 'test')

  const res = await axios.post('https://api.audd.io/', formData, {
    headers: formData.getHeaders(),
    timeout: 60000
  })

  if (res.data?.status === 'success' && res.data?.result) {
    return {
      title: res.data.result.title,
      artist: res.data.result.artist,
      youtube: {
        title: `${res.data.result.title} - ${res.data.result.artist}`,
        url: res.data.result.song_link || ''
      }
    }
  }
  throw new Error('AudD falló')
}

async function identifyMusic(audioPath) {
  try {
    return await identifyWithAnanta(audioPath)
  } catch (err) {
    console.log(`Ananta falló: ${err.message}`)
    return await identifyWithAudD(audioPath)
  }
}

async function searchYouTube(query) {
  const results = await yts(query)
  if (!results?.videos?.length) throw new Error('No encontrado')
  return results.videos[0]
}

export default {
  command: ['whatmusic', 'shazam', 'findmusic'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una identificación en proceso' }, { quoted: msg })
      return
    }
    
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    
    if (!quoted) {
      await sock.sendMessage(from, { text: '> 🎵 Responde a un audio o video para identificar la música' }, { quoted: msg })
      return
    }
    
    const isAudio = !!quoted.audioMessage
    const isVideo = !!quoted.videoMessage
    const isDocument = !!quoted.documentMessage?.mimetype?.includes('audio')
    
    if (!isAudio && !isVideo && !isDocument) {
      await sock.sendMessage(from, { text: '> 🎵 Responde a un audio, video o archivo de audio' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> 🔍 Identificando canción...' }, { quoted: msg })
    
    const tempFiles = []
    
    try {
      let buffer = null
      
      if (isAudio && quoted.audioMessage?.url) {
        const res = await fetch(quoted.audioMessage.url)
        buffer = Buffer.from(await res.arrayBuffer())
      } else if (isVideo && quoted.videoMessage?.url) {
        const res = await fetch(quoted.videoMessage.url)
        buffer = Buffer.from(await res.arrayBuffer())
      } else if (isDocument && quoted.documentMessage?.url) {
        const res = await fetch(quoted.documentMessage.url)
        buffer = Buffer.from(await res.arrayBuffer())
      } else {
        buffer = await sock.downloadMediaMessage({
          key: msg.message.extendedTextMessage.contextInfo,
          message: quoted
        })
      }
      
      if (!buffer || buffer.length < 1000) throw new Error('No se pudo descargar')
      
      const inputPath = path.join(TEMP_DIR, `${tempName()}_input`)
      const audioPath = path.join(TEMP_DIR, `${tempName()}.mp3`)
      tempFiles.push(inputPath, audioPath)
      
      fs.writeFileSync(inputPath, buffer)
      
      await sock.sendMessage(from, { text: '> 🎬 Procesando audio...', edit: processingMsg.key })
      
      await convertToMp3(inputPath, audioPath)
      
      const stats = fs.statSync(audioPath)
      if (stats.size > 10 * 1024 * 1024) {
        const compressedPath = path.join(TEMP_DIR, `${tempName()}_compressed.mp3`)
        tempFiles.push(compressedPath)
        await compressAudio(audioPath, compressedPath)
        fs.unlinkSync(audioPath)
        fs.renameSync(compressedPath, audioPath)
      }
      
      await sock.sendMessage(from, { text: '> 🔍 Identificando...', edit: processingMsg.key })
      
      const result = await identifyMusic(audioPath)
      
      if (!result.title) throw new Error('No se pudo identificar')
      
      await sock.sendMessage(from, { text: `> 🎵 *${result.title}*`, edit: processingMsg.key })
      
      // Buscar en YouTube si no hay URL
      let videoUrl = result.youtube?.url
      let videoInfo = null
      
      if (!videoUrl || !videoUrl.includes('youtu')) {
        const query = `${result.title} ${result.artist || ''}`
        videoInfo = await searchYouTube(query)
        videoUrl = videoInfo.url
      }
      
      const mensaje = `> 🎵 *CANCIÓN IDENTIFICADA*\n\n` +
        `> 🎤 *Título:* ${result.title}\n` +
        `> 👤 *Artista:* ${result.artist || 'Desconocido'}\n` +
        `> 🔗 *Enlace:* ${videoUrl}\n\n` +
        `> 🍃 Identificado por Kari`
      
      await sock.sendMessage(from, { text: mensaje, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ No se pudo identificar la canción` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      cleanup(tempFiles)
      activeUsers.delete(userId)
    }
  }
}