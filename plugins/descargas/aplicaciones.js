import axios from 'axios'

const activeDownloads = new Map()

export default {
  command: ['apk', 'app'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from

    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un nombre de aplicación 🍃\n\n> Ejemplo: .apk whatsapp' }, { quoted: msg })
      return
    }

    if (activeDownloads.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una descarga en proceso' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '📱', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> 🔍 Buscando aplicación...' }, { quoted: msg })

    activeDownloads.set(userId, true)

    try {
      const query = args.join(' ')

      const apiUrl = `https://api.princetechn.com/api/download/apkdl?apikey=prince&appName=${encodeURIComponent(query)}`
      const { data } = await axios.get(apiUrl, { timeout: 15000 })

      if (data.status !== 200 || !data.success || !data.result) {
        throw new Error('No se encontró la aplicación')
      }

      const app = {
        name: data.result.appname,
        developer: data.result.developer,
        image: data.result.appicon,
        download: data.result.download_url
      }

      await sock.sendMessage(from, { text: `> 📥 Descargando ${app.name}...`, edit: processingMsg.key })

      const response = await axios({
        method: 'GET',
        url: app.download,
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      const fileBuffer = Buffer.from(response.data)
      const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2)

      await sock.sendMessage(from, { text: `> 📤 Enviando APK (${sizeMB}MB)...`, edit: processingMsg.key })

      const sentMsg = await sock.sendMessage(from, {
        document: fileBuffer,
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${app.name.replace(/[<>:"/\\|?*]/g, '')}.apk`,
        caption: '> Descargado con éxito 🍃',
        contextInfo: {
          externalAdReply: {
            title: `📱 ${app.name}`,
            body: `${app.developer} • ${sizeMB}MB`,
            thumbnailUrl: app.image,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '✅', key: sentMsg.key } })
      }

      await sock.sendMessage(from, { text: `> ✅ APK enviada`, edit: processingMsg.key })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ ${err.message || 'Error al descargar'}`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeDownloads.delete(userId)
    }
  }
}