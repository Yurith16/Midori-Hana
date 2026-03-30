import axios from 'axios'
import config from '../../config.js'

export default {
  command: ['spotify', 'sp', 'song'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué canción quieres escuchar bb? 🎵' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      const input = args.join(' ')
      let trackUrl = input

      // 1. Buscar si no es link directo
      if (!input.includes('spotify.com')) {
        const searchApi = `https://api.delirius.store/search/spotify?q=${encodeURIComponent(input)}&limit=1`
        const { data: sData } = await axios.get(searchApi, { timeout: 10000 })

        if (!sData.status || !sData.data?.length) throw new Error('No encontrado')
        trackUrl = sData.data[0].url
      }

      // 2. Descargar (Usando una API más estable)
      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/spotify?url=${encodeURIComponent(trackUrl)}`
      const { data: dData } = await axios.get(apiUrl, { timeout: 30000 })

      if (!dData.status || !dData.data?.download) throw new Error('Error API')

      const song = dData.data
      const audioUrl = song.download
      
      // 3. Verificar peso (Límite 50MB para audio es más que suficiente)
      const head = await axios.head(audioUrl, { timeout: 10000 }).catch(() => null)
      const sizeMB = head?.headers?.['content-length'] ? (parseInt(head.headers['content-length']) / 1024 / 1024).toFixed(2) : '0.00'

      if (parseFloat(sizeMB) > 50) {
        await sock.sendMessage(from, { text: `> El audio es muy pesado oíste 🫢` }, { quoted: msg })
        return
      }

      // 4. Envío Limpio como Documento (para que no pierda calidad)
      const fileName = `${song.title} - ${song.artist}.mp3`.replace(/[<>:"/\\|?*]/g, '')

      const sentMsg = await sock.sendMessage(from, {
        document: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: fileName,
        contextInfo: {
          externalAdReply: {
            title: song.title,
            body: song.artist,
            thumbnailUrl: song.cover || 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: trackUrl,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg })

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      }
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error Spotify:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}