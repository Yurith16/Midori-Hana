import axios from 'axios'

export default {
  command: ['tiktok', 'tt', 'tk'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace de tiktok 🍃' }, { quoted: msg })
      return
    }

    // Reacción inicial
    await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } })

    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })

    try {
      const url = args[0]

      if (!url.includes('tiktok.com') && !url.includes('vt.tiktok')) {
        throw new Error('Link no válido')
      }

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/tiktok?url=${encodeURIComponent(url)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data?.video) {
        throw new Error('No se pudo obtener')
      }

      const videoUrl = data.data.video
      const title = data.data.title || 'TikTok'
      const duration = data.data.duration || 0

      if (duration > 600) {
        await sock.sendMessage(from, { 
          text: '❌ Video muy largo (máx 10 minutos)',
          edit: processingMsg.key 
        })
        return
      }

      await sock.sendMessage(from, { 
        text: `📥 ${title.substring(0, 40)}...`, 
        edit: processingMsg.key 
      })

      await sock.sendMessage(from, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        fileName: `${title.substring(0, 50).replace(/[<>:"/\\|?*]/g, '')}.mp4`,
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