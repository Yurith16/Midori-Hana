import axios from 'axios'

export default {
  command: ['facebook', 'fb', 'fbdl'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace de facebook 🍃' }, { quoted: msg })
      return
    }

    // Reacción inicial
    await sock.sendMessage(from, { react: { text: '📘', key: msg.key } })

    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })

    try {
      const url = args[0]

      if (!url.includes('facebook.com') && !url.includes('fb.com')) {
        throw new Error('Link no válido')
      }

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/fbdl?url=${encodeURIComponent(url)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data) {
        throw new Error('No se pudo obtener')
      }

      // Elegir calidad (priorizar high, sino low)
      const videoUrl = data.data.high || data.data.low

      if (!videoUrl) {
        throw new Error('No se encontró video')
      }

      await sock.sendMessage(from, { 
        text: `📥 Obteniendo información...`, 
        edit: processingMsg.key 
      })

      // Verificar tamaño del archivo
      const head = await axios.head(videoUrl, { timeout: 10000 }).catch(() => null)

      if (head?.headers?.['content-length']) {
        const sizeMB = parseInt(head.headers['content-length']) / 1024 / 1024

        if (sizeMB > 100) {
          await sock.sendMessage(from, { 
            text: `❌ Video demasiado grande (${sizeMB.toFixed(2)}MB). Límite 100MB`,
            edit: processingMsg.key 
          })
          await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
          return
        }

        await sock.sendMessage(from, { 
          text: `📥 Descargando (${sizeMB.toFixed(2)}MB)...`, 
          edit: processingMsg.key 
        })
      } else {
        await sock.sendMessage(from, { 
          text: `📥 Descargando...`, 
          edit: processingMsg.key 
        })
      }

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: `facebook_video.mp4`,
        caption: '> Descargado con éxito 🍃'
      }, { quoted: msg })

      await sock.sendMessage(from, { 
        text: '✅ Video enviado', 
        edit: processingMsg.key 
      })

      // Reacción final
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { 
        text: '❌ Error al descargar', 
        edit: processingMsg.key 
      })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}