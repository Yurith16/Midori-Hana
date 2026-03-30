import axios from 'axios'
import config from '../../config.js'

export default {
  command: ['tiktok', 'tt', 'tk'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    // Validación inicial con tu diseño "bb 🤭"
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Ups!! Olvidaste colocar el enlace bb 🤭' }, { quoted: msg })
      return
    }

    // Reacción de inicio
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      const url = args[0]
      if (!url.includes('tiktok.com')) throw new Error()

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${encodeURIComponent(url)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data?.video) throw new Error()

      const videoUrl = data.data.video
      const title = data.data.title || 'TikTok Video'
      
      // Nombre de archivo limpio para el sistema
      const cleanFileName = `${title.substring(0, 20).replace(/[<>:"/\\|?*]/g, '')} - ${config.botName}.mp4`

      // Envío del video limpio (sin externalAdReply para que sea más rápido de ver)
      const sentMsg = await sock.sendMessage(from, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: cleanFileName,
        caption: `> ${config.botName} 🍃`
      }, { quoted: msg })

      // Doble reacción final
      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error TikTok:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}