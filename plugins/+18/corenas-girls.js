import axios from 'axios'
import config from '../../config.js'

export default {
    command: ['coreanas'],
    group: false,
    owner: false,

    execute: async (sock, msg, { from }) => {
        // Verificación de Grupo Exclusivo
        if (from !== config.nsfwGroupId) {
            await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
            return sock.sendMessage(from, { 
                text: String(config.nsfwMessage) 
            }, { quoted: msg })
        }

        await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

        try {
            const apiUrl = `https://api.delirius.store/nsfw/corean`
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' })

            if (!response.data) throw new Error('Sin datos')

            await sock.sendMessage(from, {
                image: response.data,
                mimetype: 'image/jpeg',
                caption: `> 🌸 Chica coreana\n> 🍃 ${config.botName}`
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

        } catch (err) {
            console.error('Error Coreanas:', err.message)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        }
    }
}