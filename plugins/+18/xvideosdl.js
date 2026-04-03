import axios from 'axios'
import fs from 'fs'
import path from 'path'
import config from '../../config.js' 
export default {
  command: ['xvideosdl', 'xvdl', 'xvideo'],
  execute: async (sock, msg, { args, from, text }) => {
    const url = text || args[0]
    // Verificación de Grupo Exclusivo
        if (from !== config.nsfwGroupId) {
          await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
          return sock.sendMessage(from, { 
            text: String(config.nsfwMessage) 
          }, { quoted: msg })
        }

    if (!url || !/xvideos\.[a-z]+/.test(url)) {
      return sock.sendMessage(from, { text: '`🍃` *Ingresa un enlace de XVideos válido.*' }, { quoted: msg })
    }

    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/download/xvideos?url=${encodeURIComponent(url)}`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      await sock.sendMessage(from, { react: { text: '📥', key: msg.key } })

      const fileName = `xv_${Date.now()}.mp4`
      const filePath = path.join(tmpDir, fileName)

      const response = await axios({
        method: 'get',
        url: res.data.download,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://www.xvideos.com/'
        }
      })

      const writer = fs.createWriteStream(filePath)
      response.data.pipe(writer)

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      await sock.sendMessage(from, { react: { text: '📤', key: msg.key } })

      const enviado = await sock.sendMessage(from, {
        document: { url: filePath },
        mimetype: 'video/mp4',
        fileName: `${res.data.title}.mp4`,
        contextInfo: {
          externalAdReply: {
            title: res.data.title,
            body: `Duración: ${res.data.duration}`,
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

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}