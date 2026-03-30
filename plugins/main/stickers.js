import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import config from '../../config.js'

// --- CONFIGURACIÓN DE RUTAS PARA CODESPACES ---
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobeStatic.path)

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'stickers')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
  command: ['s', 'sticker', 'stiker'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    let tempFiles = []
    
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const messageToDownload = quoted ? quoted : msg.message

      let mime = (messageToDownload?.imageMessage || 
                  messageToDownload?.videoMessage || 
                  messageToDownload?.stickerMessage || 
                  messageToDownload?.documentMessage)?.mimetype || ''

      if (!/webp|image|video/g.test(mime) && !args[0]) {
        return sock.sendMessage(from, { text: '> 🖼️ Responde a una imagen o video para crear tu sticker oíste 🍃' }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

      let img
      let isVideo = /video/g.test(mime)

      // Descarga de Media
      if (args[0] && isUrl(args[0])) {
        const response = await fetch(args[0])
        img = Buffer.from(await response.arrayBuffer())
      } else {
        img = await downloadMediaMessage(
          { message: messageToDownload },
          'buffer',
          {},
          { logger: console, reuploadRequest: sock.updateMediaMessage }
        )
      }

      if (!img) throw new Error('Error al descargar')

      // Optimización idéntica a tu comando base
      if (isVideo) {
        img = await optimizeVideoForSticker(img, tempFiles)
      }

      const stickerOptions = {
        type: StickerTypes.FULL, 
        quality: isVideo ? 30 : 70, 
        pack: config.stickerPack || '',
        author: config.stickerAuthor || '© kari bot'
      }

      const sticker = new Sticker(img, stickerOptions)
      const stikerBuffer = await sticker.toBuffer()

      if (stikerBuffer.length > 1.5 * 1024 * 1024) {
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        return sock.sendMessage(from, { text: '> ⚠️ Archivo muy pesado oíste 🍃' }, { quoted: msg })
      }

      await sock.sendMessage(from, { sticker: stikerBuffer }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error en sticker:', err)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      // Limpieza de temporales
      for (let file of tempFiles) {
        try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
      }
    }
  }
}

// --- FUNCIONES DE MOTOR COPIADAS ---

async function optimizeVideoForSticker(videoBuffer, tempFiles) {
  const inputPath = path.join(TEMP_DIR, `input_${Date.now()}.mp4`)
  const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.webm`)
  tempFiles.push(inputPath, outputPath)

  await writeFileAsync(inputPath, videoBuffer)

  // Obtener info para dimensiones reales (aquí se usa ffprobe)
  const videoInfo = await getVideoInfo(inputPath)
  const width = videoInfo.width
  const height = videoInfo.height

  let newWidth = width
  let newHeight = height

  if (width > height) {
    if (width > 512) {
      newWidth = 512
      newHeight = Math.round((height / width) * 512)
    }
  } else {
    if (height > 512) {
      newHeight = 512
      newWidth = Math.round((width / height) * 512)
    }
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('webm')
      .setStartTime(0)
      .duration(6)
      .size(`${newWidth}x${newHeight}`)
      .fps(10)
      .videoBitrate('200k')
      .videoCodec('libvpx-vp9')
      .noAudio()
      .on('end', async () => {
        try {
          resolve(fs.readFileSync(outputPath))
        } catch (err) { reject(err) }
      })
      .on('error', (err) => {
        console.error('Error FFmpeg:', err)
        resolve(videoBuffer)
      })
      .save(outputPath)
  })
}

function getVideoInfo(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err)
      const stream = metadata.streams.find(s => s.codec_type === 'video')
      resolve({
        width: stream.width,
        height: stream.height,
        duration: metadata.format.duration
      })
    })
  })
}

function isUrl(text) {
  return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png|webp|mp4|mov)/, 'gi'))
}