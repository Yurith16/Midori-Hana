import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { fileTypeFromBuffer } from 'file-type'
import webp from 'node-webpmux'
import config from '../../config.js'

ffmpeg.setFfmpegPath(ffmpegPath)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const activeUsers = new Map()

async function addExif(webpSticker, packname, author, categories = ["🍃"], extra = {}) {
    const img = new webp.Image()
    const json = {
        "sticker-pack-id": crypto.randomBytes(32).toString("hex"),
        "sticker-pack-name": packname,
        "sticker-pack-publisher": author,
        emojis: categories,
        ...extra,
    }
    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
        0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ])
    const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8")
    const exif = Buffer.concat([exifAttr, jsonBuffer])
    exif.writeUIntLE(jsonBuffer.length, 14, 4)
    await img.load(webpSticker)
    img.exif = exif
    return await img.save(null)
}

function sticker6(img) {
    return new Promise(async (resolve, reject) => {
        try {
            const type = (await fileTypeFromBuffer(img)) || { mime: "image/jpeg", ext: "jpg" }
            const tmpDir = path.join(__dirname, '../../tmp')
            if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

            const tmp = path.join(tmpDir, `${+new Date()}.${type.ext}`)
            const out = path.join(tmp + ".webp")

            await fs.promises.writeFile(tmp, img)

            const Fffmpeg = /video/i.test(type.mime)
                ? ffmpeg(tmp).inputFormat(type.ext)
                : ffmpeg(tmp).input(tmp)

            Fffmpeg.on("error", function (err) {
                if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
                reject(err)
            })
            .on("end", async function () {
                if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
                if (fs.existsSync(out)) {
                    const result = await fs.promises.readFile(out)
                    fs.unlinkSync(out)
                    resolve(result)
                }
            })
            .addOutputOptions([
                `-vcodec`, `libwebp`, `-vf`,
                `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`,
            ])
            .toFormat("webp")
            .save(out)
        } catch (e) {
            reject(e)
        }
    })
}

export default {
    command: ['sticker', 's', 'stiker'],
    group: false,
    owner: false,

    async execute(sock, msg, { args, from }) {
        const userId = msg.key.participant || from
        
        if (activeUsers.has(userId)) {
            await sock.sendMessage(from, { text: '> ⏳ Ya tienes un sticker en proceso' }, { quoted: msg })
            return
        }
        
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        let targetMsg = msg
        
        if (quoted) {
            targetMsg = {
                key: {
                    remoteJid: from,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant || from
                },
                message: quoted
            }
        }
        
        const media = targetMsg.message?.imageMessage || targetMsg.message?.videoMessage
        
        if (!media) {
            await sock.sendMessage(from, { text: '> 🖼️ Responde a una imagen o video con .sticker' }, { quoted: msg })
            return
        }
        
        const isVideo = !!targetMsg.message?.videoMessage
        
        if (isVideo) {
            const duration = media.seconds || 0
            if (duration > 7) {
                await sock.sendMessage(from, { text: '> ❌ El video es demasiado largo. Máximo 7 segundos.' }, { quoted: msg })
                return
            }
        }
        
        activeUsers.set(userId, true)
        await sock.sendMessage(from, { react: { text: '🕓', key: msg.key } })
        const processingMsg = await sock.sendMessage(from, { text: '> ⏳ Procesando...' }, { quoted: msg })
        
        try {
            const buffer = await sock.downloadMediaMessage(targetMsg)
            if (!buffer) throw new Error('Error al descargar')
            
            await sock.sendMessage(from, { text: '> 🔄 Convirtiendo...', edit: processingMsg.key })
            
            const stikerBuffer = await sticker6(buffer)
            
            const pack = config.stickerPack || config.botName || 'Kari'
            const author = config.stickerAuthor || '🍃'
            const exifSticker = await addExif(stikerBuffer, pack, author)
            
            await sock.sendMessage(from, { sticker: exifSticker }, { quoted: msg })
            await sock.sendMessage(from, { text: '> ✅ Sticker enviado', edit: processingMsg.key })
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            
        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { text: '> ❌ Error al crear sticker' }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        } finally {
            activeUsers.delete(userId)
        }
    }
}