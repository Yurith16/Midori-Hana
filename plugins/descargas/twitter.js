import axios from 'axios'
import config from '../../config.js'

export default {
    command: ['twitter', 'tw', 'x', 'twdl'],
    execute: async (sock, msg, { args, from, text }) => {
        const url = text || args[0]

        if (!url) {
            return sock.sendMessage(from, { text: '> ¿Qué video de Twitter deseas descargar? 🍃' }, { quoted: msg })
        }

        if (!url.match(/twitter\.com|x\.com/)) {
            return sock.sendMessage(from, { text: '> ❌ URL de Twitter/X no válida.' }, { quoted: msg })
        }

        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

        try {
            const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/twiter?url=${encodeURIComponent(url)}`
            const { data: res } = await axios.get(apiUrl)

            if (!res.status || !res.data) throw new Error()

            // Priorizamos HD, si no existe usamos SD
            const videoUrl = res.data.HD || res.data.SD
            const thumbnail = res.data.thumbnail

            await sock.sendMessage(from, {
                video: { url: videoUrl },
                caption: `> ✅ *Video descargado.*\n\n> ${config.wm}`,
                mimetype: 'video/mp4',
                contextInfo: {
                    externalAdReply: {
                        title: '𝕏 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁',
                        body: 'Twitter / X Video Download',
                        mediaType: 1,
                        thumbnailUrl: thumbnail,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
            await sock.sendMessage(from, { text: '> ❌ No se pudo descargar el video. Intenta más tarde.' }, { quoted: msg })
        }
    }
}