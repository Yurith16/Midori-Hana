import fs from 'fs'
import path from 'path'
import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'
import { toMp4, streamToFile } from '../../utils/converter.js'

const apisVideo = [
  {
    name: 'EliteProTech',
    url: (url) => `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`,
    parse: (res) => res.data?.success && res.data?.downloadURL ? { url: res.data.downloadURL, title: res.data.title, thumbnail: res.data.thumbnail } : null
  },
  {
    name: 'Yupra',
    url: (url) => `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.success && res.data?.data?.download_url ? { url: res.data.data.download_url, title: res.data.data.title, thumbnail: res.data.data.thumbnail } : null
  },
  {
    name: 'Okatsu',
    url: (url) => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.result?.mp4 ? { url: res.data.result.mp4, title: res.data.result.title, thumbnail: res.data.result.thumbnail } : null
  },
  {
    name: 'Wadownloader',
    url: (url) => `https://wadownloader.amitdas.site/api/?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.status === 'success' && res.data?.media_url ? { url: res.data.media_url, title: res.data.title, thumbnail: res.data.thumbnail } : null
  }
]

const MAX_SIZE = 300 * 1024 * 1024
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'play2')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeDownloads = new Map()

export default {
  command: ['play2', 'ytmp4', 'ytv'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from

    if (activeDownloads.has(userId)) {
      await sock.sendMessage(from, { text: '⏳ Ya tienes una descarga en proceso' }, { quoted: msg })
      return
    }

    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace o nombre de video 🎬' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } })
    activeDownloads.set(userId, true)
    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })
    let tempFile = null
    let convertedFile = null

    try {
      const input = args.join(' ')
      let videoUrl = input
      let videoTitle = ''
      let videoThumb = ''

      // Buscar si no es URL
      if (!input.includes('youtu.be') && !input.includes('youtube.com')) {
        await sock.sendMessage(from, { text: `🔍 Buscando: "${input.substring(0, 30)}..."`, edit: processingMsg.key })

        const search = await yts(input)
        if (!search?.videos?.length) throw new Error('No encontrado')

        videoUrl = search.videos[0].url
        videoTitle = search.videos[0].title
        videoThumb = search.videos[0].thumbnail

        await sock.sendMessage(from, { text: `✅ Video encontrado: ${videoTitle}`, edit: processingMsg.key })
      }

      // Probar APIs
      let result = null
      let successApi = null

      for (const api of apisVideo) {
        try {
          console.log(`🔄 Intentando con ${api.name}...`)
          const { data } = await axios.get(api.url(videoUrl), { timeout: 30000 })
          const parsed = api.parse({ data })
          if (parsed?.url) {
            // Probar descargar un pequeño chunk para verificar que el enlace funciona
            try {
              await axios.head(parsed.url, { timeout: 10000 })
              result = parsed
              successApi = api.name
              console.log(`✅ ${api.name} funcionó correctamente`)
              await sock.sendMessage(from, { text: `✅ Video obtenido con ${api.name}`, edit: processingMsg.key })
              break
            } catch (headErr) {
              console.log(`⚠️ ${api.name} dio URL pero no responde: ${headErr.message}`)
              continue
            }
          }
        } catch (err) {
          console.log(`❌ ${api.name} falló: ${err.message}`)
        }
      }

      if (!result) throw new Error('No se pudo obtener el video')

      // Descargar archivo temporal
      tempFile = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`)

      await sock.sendMessage(from, { text: `📥 Descargando video...`, edit: processingMsg.key })

      const response = await axios.get(result.url, { 
        responseType: 'stream', 
        timeout: 120000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      await streamToFile(response.data, tempFile)

      // Verificar tamaño original
      const stats = fs.statSync(tempFile)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

      if (stats.size > MAX_SIZE) {
        throw new Error(`Video demasiado grande (${sizeMB}MB). Límite 300MB`)
      }

      // Convertir con FFmpeg
      await sock.sendMessage(from, { text: `🔄 Procesando video...`, edit: processingMsg.key })

      convertedFile = await toMp4(tempFile)

      const convertedStats = fs.statSync(convertedFile)
      const finalSizeMB = (convertedStats.size / 1024 / 1024).toFixed(2)

      await sock.sendMessage(from, { text: `📤 Enviando video (${finalSizeMB}MB)...`, edit: processingMsg.key })

      const fileName = `${(result.title || videoTitle || 'video').substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp4`
      const thumbnail = result.thumbnail || videoThumb || 'https://i.imgur.com/8g9QRs6.png'

      // Si el video pesa más de 50MB, enviar como documento
      const isLarge = convertedStats.size > 50 * 1024 * 1024

      let sentMsg
      if (isLarge) {
        sentMsg = await sock.sendMessage(from, {
          document: { stream: fs.createReadStream(convertedFile) },
          mimetype: 'video/mp4',
          fileName: fileName,
          caption: '> Descargado con éxito 🍃\n📦 Archivo pesado (>50MB), enviado como documento',
          contextInfo: {
            externalAdReply: {
              title: `🍃 ${config.botName} • 𝚅𝚒𝚍𝚎𝚘`,
              body: `${result.title || videoTitle} • ${finalSizeMB} MB`,
              thumbnailUrl: thumbnail,
              sourceUrl: videoUrl,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: msg })
      } else {
        sentMsg = await sock.sendMessage(from, {
          video: { stream: fs.createReadStream(convertedFile) },
          mimetype: 'video/mp4',
          fileName: fileName,
          caption: '> Descargado con éxito 🍃'
        }, { quoted: msg })
      }

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '✅', key: sentMsg.key } })
      }

      await sock.sendMessage(from, { text: `✅ Video enviado`, edit: processingMsg.key })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `❌ ${err.message || 'Error al descargar'}`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeDownloads.delete(userId)
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      if (convertedFile && fs.existsSync(convertedFile)) fs.unlinkSync(convertedFile)
    }
  }
}