import { downloadMediaMessage } from '@whiskeysockets/baileys'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobeStatic.path)

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'trim')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

export default {
    command: ['trim', 'cortar'],
    group: false,
    owner: false,

    async execute(sock, msg, { args, from }) {
        let tempFiles = []
        
        try {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
            const messageToDownload = quoted ? quoted : msg.message

            // Detectar video normal o video enviado como documento
            const isVideo = messageToDownload?.videoMessage
            const isDocVideo = messageToDownload?.documentMessage?.mimetype?.includes('video')

            if (!isVideo && !isDocVideo) {
                return sock.sendMessage(from, { 
                    text: '> 🍃 *Instrucciones de recorte:*\n\n' +
                          'Responde a un video o documento de video con:\n' +
                          '*.trim inicio fin*\n\n' +
                          '*Ejemplos:*\n' +
                          '• .trim 10 20 (del segundo 10 al 20)\n' +
                          '• .trim 1:00 1:30 (del minuto 1 al 1:30)\n' +
                          '• .trim 30 (los primeros 30 segundos)' 
                }, { quoted: msg })
            }

            if (args.length === 0) {
                return sock.sendMessage(from, { text: '> ⚠️ Indica el tiempo para el recorte 🍃' }, { quoted: msg })
            }

            let start = 0
            let end = 0
            if (args.length === 1) {
                end = parseToSeconds(args[0])
            } else {
                start = parseToSeconds(args[0])
                end = parseToSeconds(args[1])
            }

            const durationToCut = end - start
            if (durationToCut <= 0) throw new Error('El tiempo final debe ser mayor al inicial.')
            if (durationToCut > 90) throw new Error('El recorte no puede durar más de 90 segundos.')

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('No se pudo descargar el video.')

            const inputPath = path.join(TEMP_DIR, `in_${Date.now()}.mp4`)
            const outputPath = path.join(TEMP_DIR, `out_${Date.now()}.mp4`)
            tempFiles.push(inputPath, outputPath)

            await writeFileAsync(inputPath, buffer)

            const totalDuration = await getVideoDuration(inputPath)
            if (totalDuration > 1800) throw new Error('Video muy largo (máximo 30 min).')

            // Recorte optimizado
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .inputOptions([`-ss ${start}`])
                    .outputOptions([
                        `-t ${durationToCut}`,
                        '-c:v libx264',
                        '-c:a copy',
                        '-preset ultrafast',
                        '-movflags +faststart'
                    ])
                    .toFormat('mp4')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath)
            })

            const resultBuffer = fs.readFileSync(outputPath)

            // Enviar siempre como video normal, no como documento
            await sock.sendMessage(from, { 
                video: resultBuffer, 
                caption: `> ✅ Recorte: ${formatTime(start)} - ${formatTime(end)} 🍃` 
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error:', err)
            await sock.sendMessage(from, { text: `> ❌ ${err.message || 'Error al procesar'}` }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        } finally {
            for (let file of tempFiles) {
                try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
            }
        }
    }
}

// --- FUNCIONES EXTRA ---

function parseToSeconds(input) {
    if (!input) return 0
    if (input.includes(':')) {
        const parts = input.split(':').reverse()
        return parts.reduce((acc, part, i) => acc + (parseFloat(part) * Math.pow(60, i)), 0)
    }
    return parseFloat(input.replace(/[^\d.]/g, '')) || 0
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

function getVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) return reject(err)
            resolve(metadata.format.duration)
        })
    })
}