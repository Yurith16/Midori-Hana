import fs from 'fs'
import path from 'path'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fetch, { FormData, Blob } from 'node-fetch'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeUsers = new Map()
const randomUA = () => `CT Nasa/${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 9)}`

export default {
    command: ['tourl'],
    group: false,
    owner: false,

    async execute(sock, msg, { args, from }) {
        const userId = msg.key.participant || from
        
        if (activeUsers.has(userId)) return

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const messageToDownload = quoted ? quoted : msg.message

        // Detectar cualquier tipo de media (imagen, video, sticker)
        const mediaType = Object.keys(messageToDownload || {}).find(key => key.includes('Message') && !key.includes('protocol'))
        
        if (!mediaType || !/image|video|sticker/g.test(mediaType)) {
            return sock.sendMessage(from, { text: '> 🖼️ Responde a una imagen o video para generar la URL oíste 🍃' }, { quoted: msg })
        }

        activeUsers.set(userId, true)
        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
        
        try {
            // Descarga segura con Baileys
            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('Error al descargar')

            // Determinar extensión
            const mime = (messageToDownload[mediaType])?.mimetype || 'image/jpeg'
            let ext = '.jpg'
            if (mime.includes('png')) ext = '.png'
            else if (mime.includes('video/mp4')) ext = '.mp4'
            else if (mime.includes('webp')) ext = '.webp'
            else if (mime.includes('gif')) ext = '.gif'

            const fileName = `up_${Date.now()}${ext}`
            const tempFile = path.join(TEMP_DIR, fileName)
            fs.writeFileSync(tempFile, buffer)
            
            // Subida al servidor
            const result = await uploadFile(tempFile, fileName, mime)
            
            if (result.success && result.url) {
                // DISEÑO LIMPIO HERNÁNDEZ-STYLE
                const txt = `> 🍃 *Aquí tiene la url permanente:*\n\n` +
                            `🔗 ${result.url}`
                
                await sock.sendMessage(from, { text: txt }, { quoted: msg })
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            }

            // Limpieza inmediata de temporales
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
            
        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        } finally {
            activeUsers.delete(userId)
        }
    }
}

// --- FUNCIÓN DE SUBIDA ---
const uploadFile = async (filePath, fileName, mimeType) => {
    const endpoint = 'https://www.image2url.com/api/upload'
    try {
        const buffer = fs.readFileSync(filePath)
        const form = new FormData()
        form.append('file', new Blob([buffer], { type: mimeType }), fileName)

        const res = await fetch(endpoint, {
            method: 'POST',
            body: form,
            headers: {
                'accept': 'application/json',
                'origin': 'https://www.image2url.com',
                'referer': 'https://www.image2url.com/',
                'user-agent': randomUA()
            }
        })

        const data = await res.json()
        if (data.url) return { success: true, url: data.url }
        if (data.data && data.data.url) return { success: true, url: data.data.url }
        
        return { success: false }
    } catch (err) {
        return { success: false, message: err.message }
    }
}