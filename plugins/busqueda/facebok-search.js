import axios from 'axios'
import '../../config.js'

export default {
  command: ['fbsearch'],
  execute: async (sock, msg, { from, args, config: cfg }) => {
    // 1. Mensaje de ayuda estilo YouTube
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en Facebook? 🍃' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/search/facebooksearch?query=${encodeURIComponent(query)}`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data || res.data.length === 0) throw new Error()

      // 2. Construir el mensaje con los 5 resultados
      let txt = `*RESULTADOS DE:* ${query.toUpperCase()} 🔍\n\n`
      
      const results = res.data.slice(0, 5)

      results.forEach((item, index) => {
        const { title, description, url } = item
        
        txt += `${emojis[index]} *${title}*\n`
        txt += `> 🍃 *Descripción:* » ${description.substring(0, 100)}...\n`
        txt += `> 🌿 *Enlace:* » ${url}\n\n`
      })

      const enviado = await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg })
      
      if (enviado) {
        await sock.sendMessage(from, { react: { text: '✅', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { 
        text: `❌ *Error:* No se encontraron resultados para "${query}".` 
      }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}