import axios from 'axios'

export default {
  command: ['spotify', 'sp', 'song'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> Debe ingresar un enlace o nombre de canción 🎵' }, { quoted: msg })
      return
    }

    // Reacción inicial
    await sock.sendMessage(from, { react: { text: '🎵', key: msg.key } })

    const processingMsg = await sock.sendMessage(from, { text: '⏳ Procesando...' }, { quoted: msg })

    try {
      const input = args.join(' ')
      let trackUrl = input
      let trackTitle = ''
      let trackArtist = ''
      let coverUrl = ''

      // Si no es URL de Spotify, buscar
      if (!input.includes('spotify.com')) {
        await sock.sendMessage(from, { text: `🔍 Buscando: "${input.substring(0, 30)}..."`, edit: processingMsg.key })

        const searchApi = `https://api.delirius.store/search/spotify?q=${encodeURIComponent(input)}&limit=1`
        const { data } = await axios.get(searchApi, { timeout: 10000 })

        if (!data.status || !data.data?.length) {
          throw new Error('No encontrado')
        }

        const first = data.data[0]
        trackUrl = first.url
        trackTitle = first.title
        trackArtist = first.artist
        coverUrl = first.image
      }

      // Descargar con API
      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`
      const { data } = await axios.get(apiUrl, { timeout: 30000 })

      if (!data.status || !data.data?.download) {
        throw new Error('No se pudo obtener el audio')
      }

      const audioUrl = data.data.download
      const title = data.data.title || trackTitle || 'Spotify'
      const artist = data.data.artist || trackArtist || 'Desconocido'
      const cover = data.data.cover || coverUrl

      // Verificar tamaño
      const head = await axios.head(audioUrl, { timeout: 10000 }).catch(() => null)

      if (head?.headers?.['content-length']) {
        const sizeMB = parseInt(head.headers['content-length']) / 1024 / 1024

        if (sizeMB > 100) {
          await sock.sendMessage(from, { 
            text: `❌ Audio demasiado grande (${sizeMB.toFixed(2)}MB). Límite 100MB`,
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

      const fileName = `${title} - ${artist}.mp3`.replace(/[<>:"/\\|?*]/g, '')

      const sentMsg = await sock.sendMessage(from, {
        document: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: fileName,
        caption: `🎵 ${title} - ${artist}`,
        contextInfo: {
          externalAdReply: {
            title: `🍃 Spotify • ${title}`,
            body: `${artist} • ${head?.headers?.['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024).toFixed(2) : '?'} MB`,
            thumbnailUrl: cover || 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: trackUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '✅', key: sentMsg.key } })
      }

      await sock.sendMessage(from, { 
        text: '✅ Audio enviado', 
        edit: processingMsg.key 
      })

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