import * as cheerio from 'cheerio'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { lookup } from 'mime-types'
import config from '../../config.js'

export default {
  command: ['mediafire', 'mf'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    // Validación inicial
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Ups!! Olvidaste colocar el enlace bb 🤭' }, { quoted: msg })
      return
    }

    // Reacción de espera
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    let tempFile = null

    try {
      const url = args[0]
      if (!url.includes('mediafire.com')) throw new Error()

      // Scraping del enlace directo
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 30000
      })

      const $ = cheerio.load(res.data)
      let downloadLink = $('#downloadButton').attr('href')
      
      if (!downloadLink || downloadLink.includes('javascript:void(0)')) {
        const match = res.data.match(/href="(https:\/\/download\d+\.mediafire\.com[^"]+)"/)
        downloadLink = match ? match[1] : null
      }

      if (!downloadLink) throw new Error()

      const fileName = $('.filename').text().trim() || 'archivo_mediafire'
      const sizeText = $('#downloadButton').text().replace('Download', '').replace(/[()]/g, '').trim() || 'N/A'

      // Cálculo de tamaño para el límite de 400MB
      let sizeMB = 0
      const sizeMatch = sizeText.match(/([\d.]+)\s*(KB|MB|GB)/i)
      if (sizeMatch) {
        const num = parseFloat(sizeMatch[1])
        const unit = sizeMatch[2].toUpperCase()
        if (unit === 'KB') sizeMB = num / 1024
        if (unit === 'MB') sizeMB = num
        if (unit === 'GB') sizeMB = num * 1024
      }

      if (sizeMB > 800) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return
      }

      // Preparar directorio temporal
      const mediafireDir = path.join(process.cwd(), 'tmp', 'mediafire')
      if (!fs.existsSync(mediafireDir)) fs.mkdirSync(mediafireDir, { recursive: true })

      const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
      tempFile = path.join(mediafireDir, `${Date.now()}_${safeFileName}`)

      // Descarga por stream para archivos grandes
      const writer = fs.createWriteStream(tempFile)
      const response = await axios({
        method: 'GET',
        url: downloadLink,
        responseType: 'stream',
        timeout: 600000
      })

      response.data.pipe(writer)
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      const ext = fileName.split('.').pop()?.toLowerCase()
      const mime = lookup(ext) || 'application/octet-stream'
      const imgUrl = 'https://image2url.com/r2/default/images/1774819432365-f144e9e5-3e19-4ac7-b51f-54b90a07a6aa.jpg'

      // Envío del documento con diseño profesional
      const sentMsg = await sock.sendMessage(from, {
        document: fs.readFileSync(tempFile),
        mimetype: mime,
        fileName: fileName,
        contextInfo: {
          externalAdReply: {
            title: `🍃 ${config.botName}`,
            body: `Archivo: ${fileName} (${sizeText})`,
            thumbnailUrl: imgUrl,
            sourceUrl: url,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      // Doble reacción final
      await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error MF:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile)
    }
  }
}