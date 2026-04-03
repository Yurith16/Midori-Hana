import axios from 'axios'
import config from '../../config.js' 

export default {
  command: ['xvsearch'],
  execute: async (sock, msg, { from, args, config: cfg }) => {
    // 1. Mensaje de ayuda inicial
    if (!args[0]) 
      // Verificación de Grupo Exclusivo
              if (from !== config.nsfwGroupId) {
                await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
                return sock.sendMessage(from, { 
                  text: String(config.nsfwMessage) 
                }, { quoted: msg })
              }
      

      {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué deseas buscar en XVideos? 🔞' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      // Usamos el endpoint de xvideos con page=0 por defecto
      const apiUrl = `https://api.delirius.store/search/xvideos?query=${encodeURIComponent(query)}&page=0`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data || res.data.length === 0) throw new Error()

      // 2. Construir el mensaje con los 5 mejores resultados
      let txt = `*XVIDEOS SEARCH:* ${query.toUpperCase()} 🔞\n\n`
      
      const results = res.data.slice(0, 5)

      results.forEach((item, index) => {
        // Mapeo exacto según el JSON: author, quality, duration, url
        const { title, duration, author, quality, url } = item
        
        txt += `${emojis[index]} *${title}*\n`
        txt += `> 🍃 *Autor:* » ${author || 'Desconocido'}\n`
        txt += `> ⚘ *Info:* » ${duration} | ${quality}\n`
        txt += `> 🌿 *Enlace:* » ${url}\n\n`
      })

      const enviado = await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg })
      
      if (enviado) {
        await sock.sendMessage(from, { react: { text: '✅', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { 
        text: `❌ *Error:* No se encontraron resultados para "${query}" en XVideos.` 
      }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}