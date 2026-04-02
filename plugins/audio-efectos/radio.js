import { downloadMediaMessage } from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

ffmpeg.setFfmpegPath(ffmpegPath)
const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'effects')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
  command: ['radio', 'viejo', 'vintage'],
  execute: async (sock, msg, { from }) => {
    let tempFiles = []
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const messageToDownload = quoted ? quoted : msg.message
      let mime = (messageToDownload?.audioMessage || messageToDownload?.videoMessage || messageToDownload?.documentMessage)?.mimetype || ''

      if (!/audio|video/.test(mime)) return sock.sendMessage(from, { text: '> 📻 Responde a un audio para efecto Radio Antigua 🍃' }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '📻', key: msg.key } })
      const mediaBuffer = await downloadMediaMessage({ message: messageToDownload }, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage })

      const inputPath = path.join(TEMP_DIR, `in_rad_${Date.now()}`)
      const outputPath = path.join(TEMP_DIR, `out_rad_${Date.now()}.mp3`)
      tempFiles.push(inputPath, outputPath)
      await writeFileAsync(inputPath, mediaBuffer)

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            'bandpass=f=2000:width_type=h:width=1000', // Deja solo frecuencias medias
            'aecho=1.0:0.5:10:0.2', // Eco metálico corto
            'volume=1.5' // Compensamos la pérdida de volumen
          ])
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath)
      })

      await sock.sendMessage(from, { audio: fs.readFileSync(outputPath), mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    } catch (err) {
      console.error(err); await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}` }, { quoted: msg })
    } finally {
      for (let file of tempFiles) { try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {} }
    }
  }
}