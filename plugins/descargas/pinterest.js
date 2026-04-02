import axios from 'axios'
// Importamos la configuración para obtener el botName
import '../../config.js' 

export default {
  command: ['pinterest', 'pin'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> ¿Qué imágenes deseas buscar? 🍃' }, { quoted: msg })
      return
    }
    
    await sock.sendMessage(from, { react: { text: '📌', key: msg.key } })
    
    try {
      const query = args.join(' ')
      const apiUrl = `https://api.delirius.store/search/pinterestv2?text=${encodeURIComponent(query)}`
      const { data } = await axios.get(apiUrl, { timeout: 15000 })
      
      if (!data.status || !data.data || data.data.length === 0) {
        throw new Error('No encontrado')
      }
      
      const imagenes = data.data.sort(() => 0.5 - Math.random()).slice(0, 6)
      
      for (const img of imagenes) {
        // Si no hay descripción, usa el botName global
        const description = img.description && img.description.trim() !== '' 
          ? img.description 
          : global.botName || '© kari'

        await sock.sendMessage(from, {
          image: { url: img.image },
          caption: `> ${description}`
        }, { quoted: msg })
      }
      
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}