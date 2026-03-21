import fs from 'fs'
import path from 'path'
import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'
import { toMp3, streamToFile } from '../../utils/converter.js'

const apisAudio = [
  {
    name: 'Delirius',
    url: (url) => `https://api.delirius.store/download/ytmp3v2?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.success && res.data?.data?.download ? { url: res.data.data.download, title: res.data.data.title } : null
  },
  {
    name: 'EliteProTech',
    url: (url) => `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`,
    parse: (res) => res.data?.success && res.data?.downloadURL ? { url: res.data.downloadURL, title: res.data.title } : null
  },
  {
    name: 'Yupra',
    url: (url) => `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.success && res.data?.data?.download_url ? { url: res.data.data.download_url, title: res.data.data.title } : null
  },
  {
    name: 'Okatsu',
    url: (url) => `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.dl ? { url: res.data.dl, title: res.data.title } : null
  },
  {
    name: 'Izumi',
    url: (url) => `https://izumiiiiiiii.dpdns.org/downloader/youtube?url=${encodeURIComponent(url)}&format=mp3`,
    parse: (res) => res.data?.result?.download ? { url: res.data.result.download, title: res.data.result.title } : null
  },
  {
    name: 'Vreden',
    url: (url) => `https://api.vreden.my.id/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}`,
    parse: (res) => res.data?.result?.download?.url ? { url: res.data.result.download.url, title: res.data.result.metadata?.title } : null
  }
]

const MAX_SIZE = 300 * 1024 * 1024
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'play')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const activeDownloads = new Map()

export default {
  command: ['play'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from

    if (activeDownloads.has(userId)) {
      await sock.sendMessage(from, { text: '⏳ Ya tienes una descarga en proceso' }, { quoted: msg })
      return
    }

    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace o nombre de canción 🎵' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } })
    activeDownloads.set(userId, true)
    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })
    let tempFile = null
    let convertedFile = null

    try {
      const input = args.join(' ')
      let videoUrl = input
      let videoTitle = ''

      // Buscar si no es URL
      if (!input.includes('youtu.be') && !input.includes('youtube.com')) {
        await sock.sendMessage(from, { text: `🔍 Buscando: "${input.substring(0, 30)}..."`, edit: processingMsg.key })

        const search = await yts(input)
        if (!search?.videos?.length) throw new Error('No encontrado')

        videoUrl = search.videos[0].url
        videoTitle = search.videos[0].title
      }

      // Descargar con APIs (Delirius primero)
      let result = null
      for (const api of apisAudio) {
        try {
          const { data } = await axios.get(api.url(videoUrl), { timeout: 30000 })
          const parsed = api.parse({ data })
          if (parsed?.url) {
            result = parsed
            console.log(`✅ ${api.name} funcionó`)
            break
          }
        } catch (err) {
          console.log(`❌ ${api.name} falló`)
        }
      }

      if (!result) throw new Error('No se pudo obtener el audio')

      // Descargar archivo localmente
      tempFile = path.join(TEMP_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`)

      await sock.sendMessage(from, { text: `📥 Descargando...`, edit: processingMsg.key })

      const response = await axios.get(result.url, { responseType: 'stream', timeout: 60000 })
      await streamToFile(response.data, tempFile)

      // Verificar tamaño
      const stats = fs.statSync(tempFile)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

      if (stats.size > MAX_SIZE) {
        throw new Error(`Audio demasiado grande (${sizeMB}MB). Límite 300MB`)
      }

      // Convertir con FFmpeg
      await sock.sendMessage(from, { text: `🔄 Convirtiendo a MP3...`, edit: processingMsg.key })

      convertedFile = await toMp3(tempFile)

      const convertedStats = fs.statSync(convertedFile)
      const finalSizeMB = (convertedStats.size / 1024 / 1024).toFixed(2)

      await sock.sendMessage(from, { text: `📤 Enviando audio (${finalSizeMB}MB)...`, edit: processingMsg.key })

      const fileName = `${(result.title || videoTitle || 'audio').substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp3`

      const sentMsg = await sock.sendMessage(from, {
        document: { stream: fs.createReadStream(convertedFile) },
        mimetype: 'audio/mpeg',
        fileName: fileName,
        caption: '> Descargado con éxito 🍃',
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName} • 𝙼𝚞𝚜𝚒𝚌`,
            body: `${result.title || videoTitle} • ${finalSizeMB} MB`,
            thumbnailUrl: 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '✅', key: sentMsg.key } })
      }

      await sock.sendMessage(from, { text: `✅ Audio enviado`, edit: processingMsg.key })

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