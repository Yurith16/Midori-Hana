import axios from 'axios'

export default {
  command: ['imagen', 'img', 'googleimg'],
  execute: async (sock, msg, { from, args, text }) => {
    try {
      const consulta = text || args.join(' ')

      if (!consulta || consulta.trim() === '') {
        return sock.sendMessage(from, { 
          text: '> 🖼️ *Hernández*, por favor escribe qué imagen deseas buscar.\n\n*Ejemplo:* .imagen arboles' 
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

      // Usamos una API dedicada para evitar los bloqueos de Google
      const response = await axios.get(`https://afl-api.vercel.app/api/search/googleimage?query=${encodeURIComponent(consulta)}`)
      const data = response.data
      
      // Extraemos la lista de imágenes (esta API devuelve un array de URLs)
      const results = data.result
      const image = results[Math.floor(Math.random() * results.length)]

      if (!image) {
        return sock.sendMessage(from, { text: '> ❌ No logré encontrar imágenes para esa búsqueda, *Hernández*.' }, { quoted: msg })
      }

      await sock.sendMessage(from, { 
        image: { url: image }, 
        caption: `> 🖼️ *Resultado:* ${consulta}\n> 🌐 *Fuente:* Google Images` 
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ El servidor de búsqueda está saturado. Intenta de nuevo en un momento.` }, { quoted: msg })
    }
  }
}