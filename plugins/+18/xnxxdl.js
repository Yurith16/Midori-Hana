import axios from 'axios'
import config from '../../config.js' 

export default {
  command: ['xnxxdl'],
  nsfw: true,
  execute: async (sock, msg, { args, from, text }) => {
    const url = text || args[0]

    // Verificación de Grupo Exclusivo
        if (from !== config.nsfwGroupId) {
          await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
          return sock.sendMessage(from, { 
            text: String(config.nsfwMessage) 
          }, { quoted: msg })
        }
    
    // Mensaje de ayuda si no hay link
    if (!url || !url.includes('xnxx')) {
      return sock.sendMessage(from, { text: '`🍃` *Ingresa un enlace de XNXX válido.*' }, { quoted: msg })
    }

    // Paso 1: Buscando datos
    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/download/xnxxdl?url=${encodeURIComponent(url)}`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error('No data')

      // Filtro de 30 minutos
      const durationStr = res.data.duration || ''
      const minutesMatch = durationStr.match(/(\d+)min/)
      const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0

      if (minutes > 30) {
        await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
        return 
      }

      // Paso 2: Descargando
      await sock.sendMessage(from, { react: { text: '📥', key: msg.key } })

      const videoUrl = res.data.download.high || res.data.download.low
      const response = await axios.get(videoUrl, { 
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })

      // Paso 3: Enviando (Documento + External Reply)
      await sock.sendMessage(from, { react: { text: '📤', key: msg.key } })

      const enviado = await sock.sendMessage(from, {
        document: response.data,
        mimetype: 'video/mp4',
        fileName: `${res.data.title}.mp4`,
        contextInfo: {
          externalAdReply: {
            title: res.data.title,
            body: `Duración: ${res.data.duration}`,
            mediaType: 1,
            previewType: 0,
            renderLargerThumbnail: true,
            thumbnailUrl: res.data.gallery.default,
            sourceUrl: url
          }
        }
      }, { quoted: msg })

      // Paso Final: Éxito
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '🔥', key: enviado.key } })
      }

    } catch (err) {
      console.error('Error XNXX:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}