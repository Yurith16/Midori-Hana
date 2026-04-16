import yts from 'yt-search'
import fetch from 'node-fetch'
import config from '../../config.js'

export default {
    command: ['vid', 'video', 'ytmp4'],
    group: false,
    owner: false,

    async execute(sock, msg, { args, from }) {
        try {
            const searchQuery = args.join(' ').trim()
            
            if (!searchQuery) {
                return sock.sendMessage(from, { 
                    text: `> ⚠️ ¿Qué video buscamos, *Hernández*?` 
                }, { quoted: msg })
            }

            await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

            const { videos } = await yts(searchQuery)
            if (!videos || videos.length === 0) {
                return sock.sendMessage(from, { text: "> ❌ No hubo resultados. 🍃" }, { quoted: msg })
            }

            const video = videos[0]
            const urlYt = video.url

            await sock.sendMessage(from, { 
                text: `> ⏳ *Procesando video:* _${video.title}_ 🍃` 
            }, { quoted: msg })

            const response = await fetch('https://panel.apinexus.fun/api/youtube/v2/mp4', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-api-key': 'antbx21e5jhac' 
                },
                body: JSON.stringify({ url: urlYt })
            })

            const res = await response.json()

            if (!res || res.success !== true || !res.data || !res.data.video) {
                return sock.sendMessage(from, { 
                    text: "> ❌ Error en el servidor de video. 🍃" 
                }, { quoted: msg })
            }

            const { video: videoUrl, titulo } = res.data

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

            // Envío como DOCUMENTO sin detalles en el caption
            await sock.sendMessage(from, {
                document: { url: videoUrl },
                mimetype: 'video/mp4',
                fileName: `${titulo}.mp4`,
                caption: `` // Caption vacío como pediste
            }, { quoted: msg })

        } catch (error) {
            console.error('Error en el comando vid:', error)
            await sock.sendMessage(from, { 
                text: "> ❌ Ocurrió un error al enviar el video. 🍃" 
            }, { quoted: msg })
        }
    }
}