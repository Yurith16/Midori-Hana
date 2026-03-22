import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMP_DIR = path.join(__dirname, '../../tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const activeUsers = new Map()

export default {
  command: ['whatmusic', 'identificar', 'whatsong'],
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
    
    let tempFile = null
    
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
      
      if (!buffer || buffer.length < 1000) {
        throw new Error('No se pudo descargar el archivo')
      }
      
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2)
      if (buffer.length > MAX_SIZE) {
        await sock.sendMessage(from, { text: `> ⚠️ Archivo muy grande (${sizeMB}MB). Máximo 10MB para identificación` }, { quoted: msg })
        return
      }
      
      tempFile = path.join(TEMP_DIR, `audio_${Date.now()}.mp3`)
      fs.writeFileSync(tempFile, buffer)
      
      // Probar con Audd.io con token público
      const formData = new FormData()
      formData.append('file', fs.createReadStream(tempFile))
      formData.append('api_token', 'a64a3c1d8423e39d15b022f15fd2a4bb')
      
      const response = await axios.post('https://api.audd.io/', formData, {
        headers: formData.getHeaders(),
        timeout: 60000
      })
      
      const data = response.data
      
      if (!data.result) {
        // Si falla, probar con API de texto
        throw new Error('No se pudo identificar')
      }
      
      const song = data.result
      
      const mensaje = `> 🎵 *CANCIÓN IDENTIFICADA*\n\n` +
        `> 🎤 *Título:* ${song.title || 'Desconocido'}\n` +
        `> 👤 *Artista:* ${song.artist || 'Desconocido'}\n` +
        `> 📀 *Álbum:* ${song.album || 'Desconocido'}\n` +
        `> 🎧 *Duración:* ${song.timecode || 'N/A'}\n\n` +
        `> 🍃 Identificado por Kari`
      
      await sock.sendMessage(from, { text: mensaje, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ⚠️ No se pudo identificar la canción` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      activeUsers.delete(userId)
    }
  }
}