import { downloadMediaMessage } from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

// Configuración de rutas
ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobeStatic.path)

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'toimg')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
    command: ['toimg'],
    group: false,
    owner: false,

    async execute(sock, msg, { from }) {
        let tempFiles = []
        
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
            const messageToDownload = quoted ? quoted : msg.message

            // Solo permitimos stickers no animados para este comando
            if (!messageToDownload?.stickerMessage || messageToDownload.stickerMessage.isAnimated) {
                return sock.sendMessage(from, { text: '> 🖼️ Responde a un sticker estático para convertirlo oíste 🍃' }, { quoted: msg })
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('Error al descargar')

            const inputPath = path.join(TEMP_DIR, `temp_${Date.now()}.webp`)
            const outputPath = path.join(TEMP_DIR, `out_${Date.now()}.png`)
            tempFiles.push(inputPath, outputPath)

            await writeFileAsync(inputPath, buffer)

            // Procesamiento corregido para evitar el error de formato
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .outputOptions(['-vframes 1']) // Solo un frame para asegurar que es imagen
                    .toFormat('image2') // Usamos image2 que es el motor universal de imágenes de ffmpeg
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .save(outputPath)
            })

            const resultBuffer = fs.readFileSync(outputPath)

            await sock.sendMessage(from, { 
                image: resultBuffer, 
                caption: '> ✅ Sticker convertido a imagen🍃' 
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error en toimg:', err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        } finally {
            for (let file of tempFiles) {
                try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
            }
        }
    }
}