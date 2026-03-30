import axios from 'axios'
import config from '../../config.js'

export default {
  command: ['facebook', 'fb', 'fbdl'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Ups!! Olvidaste colocar el enlace bb 🤭' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      const url = args[0]
      if (!url.includes('facebook.com') && !url.includes('fb.com')) throw new Error()

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/fbdl?url=${encodeURIComponent(url)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data) throw new Error()

      const videoUrl = data.data.high || data.data.low
      if (!videoUrl) throw new Error()

      // Verificar tamaño
      const head = await axios.head(videoUrl, { timeout: 10000 }).catch(() => null)
      const sizeBytes = parseInt(head?.headers?.['content-length'] || 0)
      const sizeMB = sizeBytes / 1024 / 1024

      if (sizeMB > 300) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return
      }

      // Nombre del archivo personalizado (Idea 4)
      const videoTitle = `FB_Video_${Date.now()}`
      const cleanFileName = `${videoTitle} - ${config.botName}.mp4`
      const imgUrl = 'https://image2url.com/r2/default/images/1774819432365-f144e9e5-3e19-4ac7-b51f-54b90a07a6aa.jpg'

      let sentMsg
      if (sizeMB > 100) {
        // DISEÑO DOCUMENTO (con AdReply y nombre limpio)
        sentMsg = await sock.sendMessage(from, {
          document: { url: videoUrl },
          mimetype: 'video/mp4',
          fileName: cleanFileName,
          contextInfo: {
            externalAdReply: {
              title: `🍃 ${config.botName}`,
              body: 'Facebook Video (Documento)',
              thumbnailUrl: imgUrl,
              sourceUrl: url,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: msg })
      } else {
        // DISEÑO VIDEO NORMAL (Limpio)
        sentMsg = await sock.sendMessage(from, {
          video: { url: videoUrl },
          mimetype: 'video/mp4',
          caption: `> ${config.botName} 🍃`
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}