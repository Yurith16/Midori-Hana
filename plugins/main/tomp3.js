import { downloadMediaMessage } from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

ffmpeg.setFfmpegPath(ffmpegPath)

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'audio')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
    command: ['tomp3', 'toaudio'],
    group: false,
    owner: false,

    async execute(sock, msg, { from }) {
        let tempFiles = []
        
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
            const messageToDownload = quoted ? quoted : msg.message

            // Detectar video normal, video en documento o audio
            const isVideo = messageToDownload?.videoMessage
            const isDocVideo = messageToDownload?.documentMessage?.mimetype?.includes('video')
            const isAudio = messageToDownload?.audioMessage

            if (!isVideo && !isDocVideo && !isAudio) {
                return sock.sendMessage(from, { 
                    text: '> 🎵 Responde a un *video* o *documento de video* para convertirlo a audio 🍃' 
                }, { quoted: msg })
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('No se pudo descargar el archivo.')

            const inputPath = path.join(TEMP_DIR, `in_${Date.now()}`)
            const outputPath = path.join(TEMP_DIR, `out_${Date.now()}.mp3`)
            tempFiles.push(inputPath, outputPath)

            await writeFileAsync(inputPath, buffer)

            // Extracción y conversión a MP3 con FFmpeg
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioBitrate('128k')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath)
            })

            const resultBuffer = fs.readFileSync(outputPath)

            // Enviar como AUDIO de WhatsApp (reproductor naranja)
            await sock.sendMessage(from, { 
                audio: resultBuffer, 
                mimetype: 'audio/mp4', // MP4 Audio es el estándar más compatible para WhatsApp
                ptt: false // Cambiar a true si prefieres que salga como nota de voz
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error en tomp3:', err)
            await sock.sendMessage(from, { text: '> ❌ Hubo un error al extraer el audio.' }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        } finally {
            for (let file of tempFiles) {
                try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
            }
        }
    }
}