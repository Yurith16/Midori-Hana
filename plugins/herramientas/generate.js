import axios from 'axios'
import config from '../../config.js'

const activeUsers = new Map()

export default {
    command: ['generate', 'gen', 'imaginar'],
    execute: async (sock, msg, { args, from }) => {
        const userId = msg.key.participant || from
        const prompt = args.join(' ')

        if (activeUsers.has(userId)) {
            return sock.sendMessage(from, { text: '> ⏳ Ya tienes una generación en proceso.' }, { quoted: msg })
        }

        if (!prompt) {
            return sock.sendMessage(from, { text: '> ¿Qué imagen quieres? 🍃' }, { quoted: msg })
        }

        activeUsers.set(userId, true)
        await sock.sendMessage(from, { react: { text: '🎨', key: msg.key } })

        try {
            const apiUrl = `https://api.dix.lat/generate?text=${encodeURIComponent(prompt)}`
            
            const response = await axios.get(apiUrl, { 
                responseType: 'arraybuffer',
                timeout: 60000
            })

            if (!response.data) throw new Error('Sin datos')

            await sock.sendMessage(from, {
                image: response.data,
                mimetype: 'image/png',
                caption: `> 🎨 *${prompt}*\n\n> ${config.wm}`
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
            await sock.sendMessage(from, { text: `> ❌ No se pudo generar la imagen.` }, { quoted: msg })
        } finally {
            activeUsers.delete(userId)
        }
    }
}