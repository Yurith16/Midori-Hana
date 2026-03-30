import axios from 'axios'
import config from '../../config.js'

export default {
  command: ['instagram', 'ig', 'igdl'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    // Validación de entrada con tu estilo
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Ups!! Olvidaste colocar el enlace bb 🤭' }, { quoted: msg })
      return
    }

    // Reacción inicial
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      const url = args[0]
      if (!url.includes('instagram.com') && !url.includes('instagr.am')) throw new Error()

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(url)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data || !data.data.length) throw new Error()

      // Priorizar el primer video encontrado en el carrusel o post
      const videoItem = data.data.find(item => item.type === 'video') || data.data[0]
      if (!videoItem.url) throw new Error()

      const videoUrl = videoItem.url

      // Verificar tamaño para decidir el diseño de envío
      const head = await axios.head(videoUrl, { timeout: 10000 }).catch(() => null)
      const sizeBytes = parseInt(head?.headers?.['content-length'] || 0)
      const sizeMB = sizeBytes / 1024 / 1024

      // Límite de 300MB para evitar saturar el servidor
      if (sizeMB > 300) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return
      }

      const imgUrl = 'https://image2url.com/r2/default/images/1774819432365-f144e9e5-3e19-4ac7-b51f-54b90a07a6aa.jpg'
      let sentMsg

      if (sizeMB > 100) {
        // DISEÑO DOCUMENTO (Estilo Play) para videos pesados
        sentMsg = await sock.sendMessage(from, {
          document: { url: videoUrl },
          mimetype: 'video/mp4',
          fileName: `IG_Video_${Date.now()} - ${config.botName}.mp4`,
          contextInfo: {
            externalAdReply: {
              title: `🍃 ${config.botName}`,
              body: 'Instagram Video (Documento)',
              thumbnailUrl: imgUrl,
              sourceUrl: url,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: msg })
      } else {
        // DISEÑO VIDEO NORMAL (Limpio) para videos ligeros/reels
        sentMsg = await sock.sendMessage(from, {
          video: { url: videoUrl },
          mimetype: 'video/mp4',
          caption: `> ${config.botName} 🍃`
        }, { quoted: msg })
      }

      // Reacción de hojitas al archivo y éxito al usuario
      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error IG:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}