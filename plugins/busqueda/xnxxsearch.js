import axios from 'axios'
import '../../config.js'

export default {
  command: ['xnxxsearch', 'xnxxs'],
  execute: async (sock, msg, { from, args, config: cfg }) => {
    // 1. Mensaje de ayuda con la reacción de sorpresa
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en XNXX? 🔞' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/search/xnxxsearch?query=${encodeURIComponent(query)}`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data || res.data.length === 0) throw new Error()

      // 2. Construir el mensaje con los 5 mejores resultados
      let txt = `*XNXX SEARCH:* ${query.toUpperCase()} 🔞\n\n`
      
      const results = res.data.slice(0, 5)

      results.forEach((item, index) => {
        const { title, views, duration, quality, link } = item
        
        txt += `${emojis[index]} *${title}*\n`
        txt += `> 🍃 *Duración:* » ${duration}\n`
        txt += `> ⚘ *Calidad:* » ${quality} | *Vistas:* ${views}\n`
        txt += `> 🌿 *Enlace:* » ${link}\n\n`
      })

      const enviado = await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg })
      
      if (enviado) {
        await sock.sendMessage(from, { react: { text: '✅', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { 
        text: `❌ *Error:* No se encontró nada para "${query}".` 
      }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}