import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import config from '../../config.js'

// Configuración de rutas de FFmpeg
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
            const directMedia = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.stickerMessage
            const quotedMedia = quoted?.imageMessage || quoted?.videoMessage || quoted?.stickerMessage

            const mediaMessage = directMedia ? msg.message : quotedMedia ? quoted : null
            const mime = (mediaMessage?.imageMessage || mediaMessage?.videoMessage || mediaMessage?.stickerMessage)?.mimetype || ''

            if (!mediaMessage && !(args[0] && isUrl(args[0]))) {
                return sock.sendMessage(from, {
                    text: '> Responde o envía una imagen/video para crear tu sticker 🍃'
                }, { quoted: msg })
            }

            await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

            // Única descripción: nombre del bot desde config.js
            const authorName = config.botName || 'Midori-Hana'
            
            let img
            const isVideo = /video/g.test(mime) || /gif/g.test(mime)

            if (args[0] && isUrl(args[0])) {
                const response = await fetch(args[0])
                img = Buffer.from(await response.arrayBuffer())
            } else {
                const msgToDownload = directMedia ? msg : { key: msg.key, message: quoted }
                img = await downloadMediaMessage(
                    msgToDownload,
                    'buffer',
                    {},
                    { logger: console, reuploadRequest: sock.updateMediaMessage }
                )
            }

            if (!img) throw new Error('Error al descargar')

            if (isVideo) {
                img = await optimizeVideoForSticker(img, tempFiles)
            }

            const sticker = new Sticker(img, {
                type: StickerTypes.FULL,
                quality: isVideo ? 20 : 70,
                pack: '', // SE DEJA VACÍO PARA QUE NO APAREZCA NOMBRE DE PAQUETE
                author: authorName // Única descripción visible
            })

            const stikerBuffer = await sticker.toBuffer()

            if (stikerBuffer.length > 1024 * 1024) {
                await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
                return sock.sendMessage(from, {
                    text: '> El sticker supera el límite de 1MB. Intenta con un video más corto o menos movido 🍃'
                }, { quoted: msg })
            }

            await sock.sendMessage(from, { sticker: stikerBuffer }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error en sticker:', err)
            await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        } finally {
            for (let file of tempFiles) {
                try { if (fs.existsSync(file)) await unlinkAsync(file) } catch (e) {}
            }
        }
    }
}

async function optimizeVideoForSticker(videoBuffer, tempFiles) {
    const inputPath = path.join(TEMP_DIR, `input_${Date.now()}.mp4`)
    const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.webm`)
    tempFiles.push(inputPath, outputPath)

    await writeFileAsync(inputPath, videoBuffer)

    const videoInfo = await getVideoInfo(inputPath)
    const { width, height, duration } = videoInfo
    
    const targetDuration = duration > 10 ? 10 : duration
    const MAX_SIZE = 320

    let newWidth, newHeight
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
            .duration(targetDuration)
            .size(`${newWidth}x${newHeight}`)
            .fps(10)
            .videoBitrate('200k')
            .videoCodec('libvpx-vp9')
            .addOptions([
                '-crf 50', 
                '-deadline realtime', 
                '-cpu-used 4', 
                '-pix_fmt yuv420p'
            ])
            .noAudio()
            .on('end', () => {
                try { resolve(fs.readFileSync(outputPath)) } catch (err) { reject(err) }
            })
            .on('error', (err) => {
                console.error('FFmpeg Error:', err)
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
                width: stream?.width || 512,
                height: stream?.height || 512,
                duration: metadata.format?.duration || 0
            })
        })
    })
}

function isUrl(text) {
    return text?.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)(jpe?g|gif|png|webp|mp4|mov)/gi)
}