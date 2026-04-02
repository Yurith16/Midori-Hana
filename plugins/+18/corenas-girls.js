import axios from 'axios'
import '../../config.js'

export default {
  command: ['coreanas', 'koreans', 'k-girl'],
  execute: async (sock, msg, { from }) => {
    // Reacción temática de carga
    await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/nsfw/corean`
      
      // Pedimos la imagen directamente como buffer (método seguro)
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' })

      if (!response.data) throw new Error('Sin datos')

      // Enviamos la imagen totalmente limpia
      const enviado = await sock.sendMessage(from, {
        image: response.data,
        mimetype: 'image/jpeg'
      }, { quoted: msg })

      // Confirmación de éxito
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      // Reacción de fueguito al envío
      if (enviado) {
        await sock.sendMessage(from, { 
          react: { text: '🔥', key: enviado.key } 
        })
      }

    } catch (err) {
      console.error('Error Coreanas:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}