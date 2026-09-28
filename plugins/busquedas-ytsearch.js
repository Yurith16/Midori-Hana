import ytSearch from 'yt-search'
import axios from 'axios'
import sharp from 'sharp'

export default {
  command:     ['ytsearch', 'yts', 'youtube', 'buscar'],
  tag:         'ytsearch',
  categoria: 'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Busca videos en YouTube',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar un término de búsqueda.' }, { quoted: msg })
      return
    }

    const query = args.join(' ')

    try {
      const search = await ytSearch(query)
      
      if (!search.videos || search.videos.length === 0) {
        await sock.sendMessage(from, { text: 'no se encontraron resultados para tu búsqueda.' }, { quoted: msg })
        return
      }

      const videos = search.videos.slice(0, 5)
      const midoriEmojis = ['🌴', '🌱', '🦋', '🐛', '🐝']

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        const title = video.title
        const author = video.author?.name || 'desconocido'
        const duration = video.duration?.timestamp || video.duration || '--'
        const views = video.views ? Number(video.views).toLocaleString() : '--'
        const ago = video.ago || 'desconocido'
        const videoUrl = video.url.split('&')[0]
        const thumbnail = video.thumbnail

        const emo = midoriEmojis[i % midoriEmojis.length]

        // Primera letra en mayúscula para los apartados visuales
        const videoDetails = `> *${title}*\n\n` +
          `> ${emo} *Canal:* ${author}\n` +
          `> ${emo} *Duración:* ${duration}\n` +
          `> ${emo} *Vistas:* ${views}\n` +
          `> ${emo} *Publicado:* ${ago}\n` +
          `> ${emo} *Enlace:* ${videoUrl}\n\n` +
          `_resultado ${i + 1} de 5_`

        try {
          const thumbRes = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 10000 })
          const thumbBuffer = await sharp(Buffer.from(thumbRes.data))
            .resize(480, 360)
            .jpeg({ quality: 80 })
            .toBuffer()

          await sock.sendMessage(from, {
            image:   thumbBuffer,
            caption: videoDetails.trim()
          }, { quoted: msg })
        } catch {
          await sock.sendMessage(from, { text: videoDetails.trim() }, { quoted: msg })
        }
      }

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}