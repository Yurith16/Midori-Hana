import * as cheerio from 'cheerio'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { lookup } from 'mime-types'

export default {
  command: ['mediafire', 'mf'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace de mediafire 🍃' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '📁', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })

    let tempFile = null

    try {
      const url = args[0]

      if (!url.includes('mediafire.com')) {
        throw new Error('Link no válido')
      }

      await sock.sendMessage(from, { text: `🔍 Obteniendo información...`, edit: processingMsg.key })

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

      if (!downloadLink) throw new Error('No se encontró enlace')

      const fileName = $('.filename').text().trim() || 'archivo'
      const sizeText = $('#downloadButton').text().replace('Download', '').replace(/[()]/g, '').trim() || 'N/A'

      let sizeMB = 0
      const sizeMatch = sizeText.match(/([\d.]+)\s*(KB|MB|GB)/i)
      if (sizeMatch) {
        const num = parseFloat(sizeMatch[1])
        const unit = sizeMatch[2].toUpperCase()
        if (unit === 'KB') sizeMB = num / 1024
        if (unit === 'MB') sizeMB = num
        if (unit === 'GB') sizeMB = num * 1024
      }

      if (sizeMB > 400) {
        await sock.sendMessage(from, { 
          text: `❌ Archivo demasiado grande (${sizeMB.toFixed(2)}MB). Límite 400MB`,
          edit: processingMsg.key 
        })
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return
      }

      await sock.sendMessage(from, { 
        text: `📥 Descargando ${fileName} (${sizeMB > 0 ? sizeMB.toFixed(2) + 'MB' : sizeText})...`, 
        edit: processingMsg.key 
      })

      // Crear carpeta tmp/mediafire
      const mediafireDir = path.join(process.cwd(), 'tmp', 'mediafire')
      if (!fs.existsSync(mediafireDir)) {
        fs.mkdirSync(mediafireDir, { recursive: true })
      }

      // Guardar archivo localmente
      const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_')
      tempFile = path.join(mediafireDir, `${Date.now()}_${safeFileName}`)

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

      const stats = fs.statSync(tempFile)
      const finalSizeMB = stats.size / 1024 / 1024

      await sock.sendMessage(from, { 
        text: `📤 Enviando archivo (${finalSizeMB.toFixed(2)}MB)...`, 
        edit: processingMsg.key 
      })

      const ext = fileName.split('.').pop()?.toLowerCase()
      const mime = lookup(ext) || 'application/octet-stream'

      await sock.sendMessage(from, {
        document: { stream: fs.createReadStream(tempFile) },
        mimetype: mime,
        fileName: fileName,
        caption: '> Descargado con éxito 🍃'
      }, { quoted: msg })

      await sock.sendMessage(from, { 
        text: '✅ Archivo enviado', 
        edit: processingMsg.key 
      })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { 
        text: '❌ Error al descargar', 
        edit: processingMsg.key 
      })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      // Limpiar archivo temporal
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    }
  }
}