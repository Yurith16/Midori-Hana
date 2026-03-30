import axios from 'axios'
import config from '../../config.js'

const activeDownloads = new Map()

export default {
  command: ['apk', 'app'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from

    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué aplicación buscas bb? 🤭' }, { quoted: msg })
      return
    }

    if (activeDownloads.has(userId)) return 

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    activeDownloads.set(userId, true)

    try {
      const query = args.join(' ')
      const apiUrl = `https://api.princetechn.com/api/download/apkdl?apikey=prince&appName=${encodeURIComponent(query)}`
      
      const { data } = await axios.get(apiUrl, { timeout: 20000 })

      if (data.status !== 200 || !data.success || !data.result) {
        throw new Error('No se encontró')
      }

      const app = {
        name: data.result.appname,
        image: data.result.appicon || config.defaultImg,
        download: data.result.download_url
      }

      const response = await axios({
        method: 'GET',
        url: app.download,
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const fileBuffer = Buffer.from(response.data)
      const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2)

    // Límite de seguridad
      if (parseFloat(sizeMB) > 350) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        await sock.sendMessage(from, { text: `> No tengo permitido descargar aplicaciones muy pesadas 🫢` }, { quoted: msg })
        return
      }

      const sentMsg = await sock.sendMessage(from, {
        document: fileBuffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${app.name.replace(/[<>:"/\\|?*]/g, '')}.apk`,
        caption: null, // Sin descripción
        contextInfo: {
          externalAdReply: {
            title: `📱 ${app.name}`,
            body: `${sizeMB} MB • APK Download`,
            thumbnailUrl: app.image,
            sourceUrl: app.download,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      }
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error APK:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeDownloads.delete(userId)
    }
  }
}