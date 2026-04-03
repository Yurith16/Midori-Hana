import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import '../../config.js'

export default {
    command: ['wm'],
    
    async execute(sock, msg, { from, args }) {
        // 1. Extraer el sticker citado
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
        const messageToDownload = quoted?.stickerMessage ? quoted : null

        // 2. Ayuda sencilla si no hay sticker
        if (!messageToDownload) {
            await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
            await sock.sendMessage(from, { text: '> Responde a un sticker para renombrarlo 🌿' }, { quoted: msg })
            return
        }

        // 3. Lógica de Nombres (Hernández Special)
        let pack = ''
        let author = ''

        // SI ESCRIBEN TEXTO: Procesamos descripción / autor
        if (args.length > 0) {
            const input = args.join(' ').split(/\s*[\/|]\s*/)
            if (input.length > 1) {
                pack = input[0]
                author = input[1]
            } else {
                pack = args.join(' ')
                author = ''
            }
        } 
        // SI NO ESCRIBEN NADA (.wm solo): Pack y autor se quedan vacíos ('')

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

        try {
            // 4. Descarga segura
            const buffer = await downloadMediaMessage(
                { message: messageToDownload },
                'buffer',
                {},
                { logger: console, reuploadRequest: sock.updateMediaMessage }
            )

            if (!buffer) throw new Error('Error al descargar')

            // 5. Crear sticker (si pack/author son '', el sticker queda sin descripción)
            const newSticker = new Sticker(buffer, {
                pack: pack, 
                author: author,
                type: StickerTypes.FULL,
                categories: ['🤩', '🎉'],
                id: msg.id,
                quality: 75
            })

            const stickerBuffer = await newSticker.toBuffer()

            // 6. Enviar y reaccionar
            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error en WM:', err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        }
    }
}