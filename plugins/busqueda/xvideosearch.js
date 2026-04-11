import axios from 'axios'
import config from '../../config.js' 

export default {
    command: ['xvsearch'],
    execute: async (sock, msg, { from, args }) => {
        
        // 1. Verificación de Grupo Exclusivo (Siempre al inicio)
        if (from !== config.nsfwGroupId) {
            await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
            return sock.sendMessage(from, { 
                text: String(config.nsfwMessage) 
            }, { quoted: msg })
        }

        // 2. Mensaje de ayuda si no hay búsqueda
        if (!args[0]) {
            await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
            return sock.sendMessage(from, { text: '> ¿Qué deseas buscar? 🔞' }, { quoted: msg })
        }

        const query = args.join(' ')
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

        try {
            const apiUrl = `https://api.delirius.store/search/xvideos?query=${encodeURIComponent(query)}&page=0`
            const { data: res } = await axios.get(apiUrl)

            if (!res.status || !res.data || res.data.length === 0) throw new Error()

            let txt = `> 🔞 *RESULTADOS:* ${query.toUpperCase()}\n\n`
            const results = res.data.slice(0, 5)

            results.forEach((item, index) => {
                const { title, duration, author, quality, url } = item
                txt += `${emojis[index]} *${title}*\n`
                txt += `> 🍃 *Autor:* ${author || 'Desconocido'}\n`
                txt += `> ⚘ *Info:* ${duration} | ${quality}\n`
                txt += `> 🔗 *URL:* ${url}\n\n`
            })

            const enviado = await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg })
            
            if (enviado) {
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            }

        } catch (err) {
            await sock.sendMessage(from, { 
                text: `> ❌ No se encontraron resultados para "${query}".` 
            }, { quoted: msg })
            await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        }
    }
}