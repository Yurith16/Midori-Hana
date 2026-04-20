import axios from 'axios'

export default {
  command: ['gelbooru', 'gb'],
  nsfw: true, // Recuerda tener activado el nsfw en el grupo
  execute: async (sock, msg, { from }) => {
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.get('https://panel.apinexus.fun/api/gelbooru', {
        headers: { 'x-api-key': 'antbx21e5jhac' }
      })

      if (!res.success || !res.data || !res.data.url) throw new Error()

      // Enviamos la imagen sin ningún texto
      const sentMsg = await sock.sendMessage(from, { 
        image: { url: res.data.url }
      }, { quoted: msg })

      // Reacción a la imagen enviada
      await sock.sendMessage(from, { 
        react: { text: '🍃', key: sentMsg.key } 
      })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}