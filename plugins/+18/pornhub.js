import axios from 'axios'
import fs from 'fs'
import path from 'path'
import '../../config.js'

export default {
  command: ['pornhubdl'],
  execute: async (sock, msg, { args, from, text }) => {
    const url = text || args[0]
    
    if (!url || !url.includes('pornhub.com')) {
      return sock.sendMessage(from, { text: '`🍃` *Ingresa un enlace de Pornhub válido.*' }, { quoted: msg })
    }

    // Carpeta temporal (asegúrate de que exista o el bot la creará)
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/download/pornhub?url=${encodeURIComponent(url)}`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error('No data')

      const videoData = res.data.video.find(v => v.quality === '480') || res.data.video.find(v => v.quality === '360')
      if (!videoData) throw new Error('Calidad no permitida')

      await sock.sendMessage(from, { react: { text: '📥', key: msg.key } })

      // Nombre temporal único para evitar choques entre usuarios
      const fileName = `ph_${Date.now()}.mp4`
      const filePath = path.join(tmpDir, fileName)

      // Descargamos y escribimos en el disco (tmp/)
      const response = await axios({
        method: 'get',
        url: videoData.download,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.pornhub.com/'
        }
      })

      const writer = fs.createWriteStream(filePath)
      response.data.pipe(writer)

      // Esperamos a que termine de escribirse en el disco
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      await sock.sendMessage(from, { react: { text: '📤', key: msg.key } })

      // Enviamos el archivo desde la ruta del disco
      const enviado = await sock.sendMessage(from, {
        document: { url: filePath },
        mimetype: 'video/mp4',
        fileName: `${res.data.title}.mp4`,
        contextInfo: {
          externalAdReply: {
            title: res.data.title,
            body: `Calidad: ${videoData.quality}p`,
            mediaType: 1,
            renderLargerThumbnail: true,
            thumbnailUrl: res.data.image,
            sourceUrl: url
          }
        }
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '🔥', key: enviado.key } })
      }

      // ELIMINACIÓN AUTOMÁTICA DEL ARCHIVO
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log(`[LIMPIEZA] Archivo eliminado: ${fileName}`)
      }

    } catch (err) {
      console.error('Error Pornhub:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}