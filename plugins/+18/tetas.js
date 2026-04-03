import axios from 'axios'
import config from '../../config.js' 

export default {
  command: ['boobs', 'tetas', 'pechos'],
  execute: async (sock, msg, { from }) => {

    // Verificación de Grupo Exclusivo
        if (from !== config.nsfwGroupId) {
          await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
          return sock.sendMessage(from, { 
            text: String(config.nsfwMessage) 
          }, { quoted: msg })
        }

    // Reacción inicial
    await sock.sendMessage(from, { react: { text: '🍒', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/nsfw/boobs`
      
      // Pedimos la imagen directamente como buffer
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' })

      if (!response.data) throw new Error('Sin datos')

      // Enviamos la imagen sin descripción
      const enviado = await sock.sendMessage(from, {
        image: response.data,
        mimetype: 'image/jpeg'
      }, { quoted: msg })

      // Reacción de éxito al comando
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      // Reacción de fueguito a la imagen enviada
      if (enviado) {
        await sock.sendMessage(from, { 
          react: { text: '🔥', key: enviado.key } 
        })
      }

    } catch (err) {
      console.error('Error Boobs:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}