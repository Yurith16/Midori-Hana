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
  command: ['alien', 'marciano', 'et'],
  execute: async (sock, msg, { from }) => {
    let tempFiles = []
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const messageToDownload = quoted ? quoted : msg.message
      let mime = (messageToDownload?.audioMessage || messageToDownload?.videoMessage || messageToDownload?.documentMessage)?.mimetype || ''

      if (!/audio|video/.test(mime)) return sock.sendMessage(from, { text: '> 👽 Responde a un audio para transformarlo en Alien 🛸' }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '👽', key: msg.key } })
      const mediaBuffer = await downloadMediaMessage({ message: messageToDownload }, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage })

      const inputPath = path.join(TEMP_DIR, `in_alien_${Date.now()}`)
      const outputPath = path.join(TEMP_DIR, `out_alien_${Date.now()}.mp3`)
      tempFiles.push(inputPath, outputPath)
      await writeFileAsync(inputPath, mediaBuffer)

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            // 1. Modulación de coro extrema: Crea esa duplicación metálica
            'chorus=0.7:0.9:55:0.4:0.25:2',
            // 2. Vibrato a máxima velocidad: Esto "pica" la voz de forma eléctrica (Efecto Alien)
            'vibrato=f=40:d=1',
            // 3. Ecualización: Quitamos graves y agudos naturales, resaltamos medios (1000Hz)
            'highpass=f=300',
            'lowpass=f=3500',
            'equalizer=f=1000:width_type=h:width=200:g=10',
            // 4. Volumen final
            'volume=1.5'
          ])
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', (err) => {
            console.error('FFmpeg Error:', err)
            reject(err)
          })
          .save(outputPath)
      })

      await sock.sendMessage(from, { audio: fs.readFileSync(outputPath), mimetype: 'audio/mpeg', ptt: false }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}` }, { quoted: msg })
    } finally {
      for (let file of tempFiles) { try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {} }
    }
  }
}