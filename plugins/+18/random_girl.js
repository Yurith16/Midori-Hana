import axios from 'axios'
import config from '../../config.js' 

export default {
  command: ['girls', 'chicas', 'tkgirls'],
  nsfw: true,
  execute: async (sock, msg, { from }) => {
    // Verificación de Grupo Exclusivo
    if (from !== config.nsfwGroupId) {
      await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
      return sock.sendMessage(from, { 
        text: String(config.nsfwMessage) 
      }, { quoted: msg })
    }
    await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/nsfw/tiktok`
      
      const response = await axios.get(apiUrl, { responseType: 'arraybuffer' })

      if (!response.data) throw new Error('Sin datos')

      // Enviamos el video SIN caption (descripción)
      const enviado = await sock.sendMessage(from, {
        video: response.data,
        mimetype: 'video/mp4'
      }, { quoted: msg })

      // Reacción de éxito al comando
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      // Reacción de fueguito al video enviado
      if (enviado) {
        await sock.sendMessage(from, { 
          react: { text: '🔥', key: enviado.key } 
        })
      }

    } catch (err) {
      console.error('Error Girls:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}