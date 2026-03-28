import fs from 'fs'
import path from 'path'
import fetch, { FormData, Blob } from 'node-fetch'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMP_DIR = path.join(__dirname, '../../tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeUsers = new Map()

const randomVersion = () =>
  `${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`

const randomUA = () => `CT Nasa/${randomVersion()}`

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.webm']

const getMimeType = (ext) => {
  switch (ext) {
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.png': return 'image/png'
    case '.gif': return 'image/gif'
    case '.mp4': return 'video/mp4'
    case '.mov': return 'video/quicktime'
    case '.webm': return 'video/webm'
    default: return 'application/octet-stream'
  }
}

const uploadFile = async (filePath) => {
  const endpoint = 'https://www.image2url.com/api/upload'

  if (!fs.existsSync(filePath)) return { success: false, message: 'Archivo no encontrado' }

  const ext = path.extname(filePath).toLowerCase()
  if (!allowedExtensions.includes(ext)) return { success: false, message: `Formato no soportado: ${ext}` }

  try {
    const buffer = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const mimeType = getMimeType(ext)

    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimeType }), fileName)

    const res = await fetch(endpoint, {
      method: 'POST',
      body: form,
      headers: {
        accept: 'application/json, text/plain, */*',
        'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
        origin: 'https://www.image2url.com',
        referer: 'https://www.image2url.com/',
        'user-agent': randomUA()
      }
    })

    const text = await res.text()
    if (!res.ok) return { success: false, status: res.status, message: text }

    try { return JSON.parse(text) } catch { return { success: true, raw: text } }
  } catch (err) {
    return { success: false, message: err.message }
  }
}

export default {
  command: ['upload', 'tourl', 'img'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, store }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una subida en proceso' }, { quoted: msg })
      return
    }
    
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
    let stanzaId = null
    let targetMsg = null
    
    if (ctxInfo?.quotedMessage) {
      stanzaId = ctxInfo.stanzaId
      targetMsg = ctxInfo.quotedMessage
    }
    
    const media = targetMsg?.imageMessage || targetMsg?.videoMessage || msg.message?.imageMessage || msg.message?.videoMessage
    
    if (!media) {
      await sock.sendMessage(from, { text: '> 🖼️ Responde a una imagen o video con .upload' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '🕒', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> ⏳ Descargando archivo...' }, { quoted: msg })
    
    try {
      let buffer = null
      
      // Intentar obtener del store (mensaje guardado)
      if (stanzaId && store?.loadMessage) {
        const storedMsg = await store.loadMessage(from, stanzaId)
        if (storedMsg?.message?.imageMessage?.url) {
          const res = await fetch(storedMsg.message.imageMessage.url)
          buffer = Buffer.from(await res.arrayBuffer())
        } else if (storedMsg?.message?.videoMessage?.url) {
          const res = await fetch(storedMsg.message.videoMessage.url)
          buffer = Buffer.from(await res.arrayBuffer())
        }
      }
      
      // Si no funcionó, usar la URL directa del media (puede estar encriptada)
      if (!buffer && media.url) {
        const res = await fetch(media.url)
        buffer = Buffer.from(await res.arrayBuffer())
      }
      
      if (!buffer || buffer.length < 100) {
        throw new Error('No se pudo descargar el archivo')
      }
      
      // Guardar archivo localmente
      let ext = '.jpg'
      if (media.videoMessage) ext = '.mp4'
      else if (media.imageMessage) {
        const mime = media.imageMessage.mimetype
        if (mime === 'image/png') ext = '.png'
        else if (mime === 'image/gif') ext = '.gif'
        else if (mime === 'image/webp') ext = '.webp'
      }
      
      const fileName = `upload_${Date.now()}${ext}`
      const tempFile = path.join(TEMP_DIR, fileName)
      fs.writeFileSync(tempFile, buffer)
      
      await sock.sendMessage(from, { text: `> 📁 Archivo guardado: ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`, edit: processingMsg.key })
      
      const result = await uploadFile(tempFile)
      
      if (result.success && result.url) {
        const txt = `*── 「 IMAGE2URL 」 ──*\n\n` +
          `▢ *ARCHIVO:* ${fileName}\n` +
          `▢ *URL:* ${result.url}\n` +
          `▢ *TAMAÑO:* ${(buffer.length / 1024).toFixed(2)} KB\n\n` +
          `> 🍃 Archivo guardado en tmp/${fileName}`
        
        await sock.sendMessage(from, { text: txt, edit: processingMsg.key })
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      } else {
        await sock.sendMessage(from, { text: `> ❌ Error: ${result.message || 'No se pudo subir'}`, edit: processingMsg.key })
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      }
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}