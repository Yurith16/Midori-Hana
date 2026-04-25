import fs from 'fs'
import path from 'path'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fetch, { FormData, Blob } from 'node-fetch'
import { getSubbotSettings, updateSubbotSettings } from '../../database/db-subbot.js'

const TEMP_DIR = path.join(process.cwd(), 'tmp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const randomUA = () => `CT Nasa/${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 9)}`

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

export default {
    command: ['sbmenuimg', 'sbmenuimg'],
    group: false,
    owner: false,

    async execute(sock, msg, { from, isOwner, isSubbotOwner, subbotNumero }) {
        if (!subbotNumero) {
            await sock.sendMessage(from, { text: '> ❌ Este comando solo funciona en subbots.' }, { quoted: msg })
            return
        }

        if (!isOwner && !isSubbotOwner) {
            await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
            await sock.sendMessage(from, { text: '> Solo el dueño del subbot puede cambiar la imagen del menú.' }, { quoted: msg })
            return
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const messageToDownload = quoted ? quoted : msg.message

        const mediaType = Object.keys(messageToDownload || {}).find(key => key.includes('Message') && !key.includes('protocol'))
        
        if (!mediaType || !/image/g.test(mediaType)) {
            await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
            await sock.sendMessage(from, { text: '> 🖼️ Responde a una imagen para establecerla como imagen del menú 🍃' }, { quoted: msg })
            return
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
        
        try {
            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('Error al descargar')

            const mime = (messageToDownload[mediaType])?.mimetype || 'image/jpeg'
            let ext = '.jpg'
            if (mime.includes('png')) ext = '.png'
            else if (mime.includes('webp')) ext = '.webp'
            else if (mime.includes('gif')) ext = '.gif'

            const fileName = `menu_${subbotNumero}_${Date.now()}${ext}`
            const tempFile = path.join(TEMP_DIR, fileName)
            fs.writeFileSync(tempFile, buffer)
            
            const result = await uploadFile(tempFile, fileName, mime)
            
            if (result.success && result.url) {
                await updateSubbotSettings(subbotNumero, { menuImage: result.url })
                
                await sock.sendMessage(from, { 
                    text: `> ✅ *Imagen del menú actualizada* 🍃\n\n> 📸 URL:\n${result.url}\n\n> Ahora tu menú usará esta imagen personalizada.` 
                }, { quoted: msg })
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            } else {
                throw new Error('Error al subir la imagen')
            }

            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
            
        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
            await sock.sendMessage(from, { text: '> Error al procesar la imagen. Intenta con otra 🍃' }, { quoted: msg })
        }
    }
}