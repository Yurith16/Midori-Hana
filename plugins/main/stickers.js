import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import config from '../../config.js'

// --- CONFIGURACIÓN DE RUTAS ---
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

      // Optimización para videos (Stickers animados)
      if (isVideo) {
        img = await optimizeVideoForSticker(img, tempFiles)
      }

      const stickerOptions = {
        type: StickerTypes.FULL, 
        quality: isVideo ? 25 : 70, // Bajamos un poco más la calidad en video para asegurar peso
        pack: config.stickerPack,
        author: config.stickerAuthor || '© Hernández'
      }

      const sticker = new Sticker(img, stickerOptions)
      const stikerBuffer = await sticker.toBuffer()

      // Límite estricto de 1MB para evitar errores de reproducción en WhatsApp
      if (stikerBuffer.length > 1024 * 1024) {
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        return sock.sendMessage(from, { text: '> ⚠️ El sticker es muy pesado (>1MB) y no se verá. Intenta con un video más corto oíste 🍃' }, { quoted: msg })
      }

      await sock.sendMessage(from, { sticker: stikerBuffer }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error en sticker:', err)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      // Limpieza de archivos temporales
      for (let file of tempFiles) {
        try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
      }
    }
  }
}

// --- FUNCIONES DE PROCESAMIENTO ---

async function optimizeVideoForSticker(videoBuffer, tempFiles) {
  const inputPath = path.join(TEMP_DIR, `input_${Date.now()}.mp4`)
  const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.webm`)
  tempFiles.push(inputPath, outputPath)

  await writeFileAsync(inputPath, videoBuffer)

  // Obtener info técnica del video
  const videoInfo = await getVideoInfo(inputPath)
  const { width, height } = videoInfo

  // Reducimos la escala base a 320px para ahorrar muchísimo peso sin perder vista
  let newWidth = width
  let newHeight = height
  const MAX_SIZE = 320

  if (width > height) {
    newWidth = MAX_SIZE
    newHeight = Math.round((height / width) * MAX_SIZE)
  } else {
    newHeight = MAX_SIZE
    newWidth = Math.round((width / height) * MAX_SIZE)
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('webm')
      .setStartTime(0)
      .duration(5) // Máximo 5 segundos para stickers animados
      .size(`${newWidth}x${newHeight}`)
      .fps(8) // FPS bajo para reducir peso manteniendo fluidez
      .videoBitrate('150k')
      .videoCodec('libvpx-vp9')
      .addOptions([
        '-crf 45', // Compresión constante (mayor número = menos peso)
        '-deadline realtime',
        '-cpu-used 4',
        '-pix_fmt yuv420p'
      ])
      .noAudio()
      .on('end', async () => {
        try {
          resolve(fs.readFileSync(outputPath))
        } catch (err) { reject(err) }
      })
      .on('error', (err) => {
        console.error('Error FFmpeg:', err)
        resolve(videoBuffer) // Si falla la optimización, devolvemos el original
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
        width: stream?.width || 512,
        height: stream?.height || 512,
        duration: metadata.format?.duration || 0
      })
    })
  })
}

function isUrl(text) {
  return text.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png|webp|mp4|mov)/, 'gi'))
}