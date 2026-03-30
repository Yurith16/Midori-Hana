import fs from 'fs'
import path from 'path'
import yts from 'yt-search'
import YTDlpWrap from 'yt-dlp-wrap'
import config from '../../config.js'

const TEMP_DIR = path.join(process.cwd(), 'tmp', 'test')
const YTDLP_PATH = path.join(process.cwd(), 'yt-dlp')

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

const tempName = () => `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`

function extractVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

let ytDlpWrap = null

async function initYtDlp() {
  if (ytDlpWrap) return ytDlpWrap

  if (!fs.existsSync(YTDLP_PATH)) {
    console.log('⏳ Descargando yt-dlp...')
    await YTDlpWrap.downloadFromGithub(YTDLP_PATH)
    fs.chmodSync(YTDLP_PATH, 0o755)
    console.log('✅ yt-dlp listo')
  }

  const YTDlpWrapClass = YTDlpWrap.default || YTDlpWrap
  ytDlpWrap = new YTDlpWrapClass(YTDLP_PATH)
  return ytDlpWrap
}

async function downloadAudio(url, outputPath) {
  return new Promise((resolve, reject) => {
    const process = ytDlpWrap.exec([
      url,
      '-f', 'bestaudio/best', 
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', outputPath,
      '--cookies', './cookies.txt', // ← Usando el archivo que ya probaste
      '--no-check-certificates',
      '--no-warnings',
      '--newline'
    ])

    let error = ''

    process.stderr?.on('data', (data) => error += data)
    process.stdout?.on('data', (data) => console.log(data.toString().trim()))

    process.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Error ${code}: ${error}`))
    })

    process.on('error', reject)
  })
}

const activeUsers = new Map()

export default {
  command: ['test', 't'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) {
      await sock.sendMessage(from, { text: '> ⏳ Ya tienes una descarga en proceso' }, { quoted: msg })
      return
    }
    
    if (!args || args.length === 0) {
      await sock.sendMessage(from, { text: '> 🎵 ¿Qué audio deseas probar? 🍃' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '> ⏬ Obteniendo audio...' }, { quoted: msg })
    
    const input = args.join(' ')
    const isUrl = /youtu\.be|youtube\.com/.test(input)
    const tempFile = path.join(TEMP_DIR, tempName())
    
    try {
      await initYtDlp()
      
      let videoUrl, videoTitle
      
      if (isUrl) {
        const videoId = extractVideoId(input)
        if (!videoId) throw new Error('URL inválida')
        videoUrl = `https://youtu.be/${videoId}`
        
        const info = await yts({ videoId })
        videoTitle = info.title
      } else {
        const search = await yts(input)
        if (!search.videos || search.videos.length === 0) throw new Error('No encontrado')
        videoUrl = search.videos[0].url
        videoTitle = search.videos[0].title
      }
      
      await sock.sendMessage(from, { 
        text: `> 📥 Descargando: ${videoTitle.substring(0, 30)}...`, 
        edit: processingMsg.key 
      })
      
      await downloadAudio(videoUrl, tempFile)
      
      if (!fs.existsSync(tempFile)) throw new Error('El archivo no se generó.')

      const stats = fs.statSync(tempFile)
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
      
      await sock.sendMessage(from, {
        audio: fs.readFileSync(tempFile),
        mimetype: 'audio/mpeg',
        fileName: `${videoTitle.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp3`,
        caption: `${videoUrl}`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: `${videoTitle} • ${sizeMB}MB`,
            thumbnailUrl: 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: videoUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })
      
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      await sock.sendMessage(from, { text: `> ✅ Audio enviado`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}`, edit: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}