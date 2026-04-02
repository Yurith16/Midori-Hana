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
  command: ['bass', 'bajo', 'bassboost'],
  execute: async (sock, msg, { from }) => {
    let tempFiles = []
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const messageToDownload = quoted ? quoted : msg.message
      let mime = (messageToDownload?.audioMessage || messageToDownload?.videoMessage || messageToDownload?.documentMessage)?.mimetype || ''

      if (!/audio|video/.test(mime)) return sock.sendMessage(from, { text: '> 🎙️ Responde a un audio o video para aumentar los golpes (Bass) 🍃' }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '🔊', key: msg.key } })
      const mediaBuffer = await downloadMediaMessage({ message: messageToDownload }, 'buffer', {}, { logger: console, reuploadRequest: sock.updateMediaMessage })

      const inputPath = path.join(TEMP_DIR, `in_bass_${Date.now()}`)
      const outputPath = path.join(TEMP_DIR, `out_bass_${Date.now()}.mp3`)
      tempFiles.push(inputPath, outputPath)
      await writeFileAsync(inputPath, mediaBuffer)

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            // 1. Corte de frecuencias "basura" (debajo de 35Hz) para evitar vibraciones innecesarias
            'highpass=f=35',
            // 2. Ecualizador: Bajamos la intensidad a g=7 para que sea potente pero fino
            'equalizer=f=60:width_type=h:width=50:g=7',
            // 3. Brillo: Subimos un poquito los agudos (f=3000) para que la voz sea nítida
            'equalizer=f=3000:width_type=h:width=100:g=2',
            // 4. Limitador Estricto: Asegura que NADA pase del límite digital (0.95)
            'alimiter=level_in=1:level_out=0.95:limit=0.85:attack=5:release=20',
            // 5. Volumen controlado para no saturar la salida
            'volume=1.1'
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
      await sock.sendMessage(from, { text: `> ❌ Error en el proceso: ${err.message}` }, { quoted: msg })
    } finally {
      for (let file of tempFiles) { try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {} }
    }
  }
}