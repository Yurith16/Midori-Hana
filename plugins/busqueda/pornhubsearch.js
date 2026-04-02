import axios from 'axios'
import '../../config.js'

export default {
  command: [ 'phsearch'],
  execute: async (sock, msg, { from, args, config: cfg }) => {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en Pornhub? 🔞' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      // Agregada la apikey y page=1 por defecto para evitar el error de búsqueda
      const apiUrl = `https://api.delirius.store/search/pornhub?query=${encodeURIComponent(query)}&page=1&apikey=DkAJ1Lqs`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data || res.data.length === 0) throw new Error()

      let txt = `*PORNHUB SEARCH:* ${query.toUpperCase()} 🔞\n\n`
      
      const results = res.data.slice(0, 5)

      results.forEach((item, index) => {
        // Mapeo exacto: user, duration, views y url
        const { title, views, duration, user, url } = item
        
        txt += `${emojis[index]} *${title}*\n`
        txt += `> 🍃 *Canal:* » ${user || 'Anónimo'}\n`
        txt += `> ⚘ *Duración:* » ${duration} | *Vistas:* ${views}\n`
        txt += `> 🌿 *Enlace:* » ${url}\n\n`
      })

      const enviado = await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg })
      
      if (enviado) {
        await sock.sendMessage(from, { react: { text: '✅', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { 
        text: `❌ *Error:* No se pudo conectar con Pornhub. Verifica la búsqueda o intenta más tarde.` 
      }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}