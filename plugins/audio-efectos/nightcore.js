import { downloadMediaMessage } from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

// --- CONFIGURACIÓN DE RUTAS PARA TU SERVIDOR ---
ffmpeg.setFfmpegPath(ffmpegPath)

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'effects')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
  command: ['nightcore', 'nc'],
  execute: async (sock, msg, { from }) => {
    let tempFiles = []
    
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
      const messageToDownload = quoted ? quoted : msg.message

      // Detectamos si es audio, video o documento (audio/video)
      let mime = (
        messageToDownload?.audioMessage || 
        messageToDownload?.videoMessage || 
        messageToDownload?.documentMessage
      )?.mimetype || ''

      if (!/audio|video/.test(mime)) {
        return sock.sendMessage(from, { text: '> 🎙️ Responde a un audio o video para aplicar el verdadero efecto Nightcore ⚡' }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '⚡', key: msg.key } })

      const mediaBuffer = await downloadMediaMessage(
        { message: messageToDownload },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      )

      const inputPath = path.join(TEMP_DIR, `in_nc_${Date.now()}`)
      const outputPath = path.join(TEMP_DIR, `out_nc_${Date.now()}.mp3`)
      tempFiles.push(inputPath, outputPath)

      await writeFileAsync(inputPath, mediaBuffer)

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .audioFilters([
            // EL ESTÁNDAR REAL (35% de aceleración):
            // asetrate eleva el tono (pitch) y la velocidad simultáneamente al 1.35%
            'asetrate=44100*1.35',
            // atempo=1.0 mantiene la velocidad resultante de la frecuencia anterior
            'atempo=1.0',
            // Refuerzo de bajos para que no pierda cuerpo al volverse agudo
            'bass=g=5'
          ])
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', (err) => {
            console.error('Detalle FFmpeg:', err)
            reject(err)
          })
          .save(outputPath)
      })

      // Enviamos como AUDIO naranja para que se aprecie la edición musical
      await sock.sendMessage(from, { 
        audio: fs.readFileSync(outputPath), 
        mimetype: 'audio/mpeg',
        ptt: false 
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}` }, { quoted: msg })
    } finally {
      // Limpieza de archivos temporales
      for (let file of tempFiles) {
        try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
      }
    }
  }
}