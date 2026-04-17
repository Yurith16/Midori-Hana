import axios from 'axios'
import config from '../../config.js' 

export default {
  command: ['random', 'girl'],
  nsfw: true,
  execute: async (sock, msg, { from }) => {
    // Verificación de Grupo Exclusivo
        if (from !== config.nsfwGroupId) {
          await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
          return sock.sendMessage(from, { 
            text: String(config.nsfwMessage) 
          }, { quoted: msg })
        }
    
    // Reacción de carga (Diferente para identificar el comando)
    await sock.sendMessage(from, { react: { text: '👗', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/nsfw/girls`
      
      // Pedimos la imagen directamente como buffer
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' })

      if (!response.data) throw new Error('Sin datos')

      // Enviamos la imagen totalmente limpia (sin caption)
      const enviado = await sock.sendMessage(from, {
        image: response.data,
        mimetype: 'image/jpeg'
      }, { quoted: msg })

      // Confirmación de éxito al comando original
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      // Reacción de fueguito a la imagen que envió el bot
      if (enviado) {
        await sock.sendMessage(from, { 
          react: { text: '🔥', key: enviado.key } 
        })
      }

    } catch (err) {
      console.error('Error Girls-Img:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}