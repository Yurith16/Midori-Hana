import axios from 'axios'
import '../../config.js'

export default {
  command: ['girls', 'chicas', 'tkgirls'],
  execute: async (sock, msg, { from }) => {
    // Reacción de carga
    await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/nsfw/tiktok`
      const { data } = await axios.get(apiUrl)

      // Buscamos el video en todas las rutas posibles de la API de Delirius
      const videoUrl = data.result?.video || data.result?.url || data.video || data.url || data.result

      // Si no hay URL o no es un string, lanzamos el error controlado
      if (!videoUrl || typeof videoUrl !== 'string') {
        throw new Error('Video no encontrado en la respuesta')
      }

      // Diseño Estético con Hojitas
      const captionTemplate = `> 🍃 *𝐆𝐈𝐑𝐋𝐒 𝐓𝐈𝐊𝐓𝐎𝐊*\n> \n> 🍃 ${global.botName || '© kari'}`

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: captionTemplate,
        mimetype: 'video/mp4'
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error Girls:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}