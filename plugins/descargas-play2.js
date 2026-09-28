import ytSearch from 'yt-search'

const API_KEY = 'lem_c92ba8f5ed716cd9d1ba968623728690dc706dcb'

async function fetchConReintentos(url, opciones = {}, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(url, opciones)
      if (res.ok) return res
    } catch (e) {
      // silencio, reintenta
    }
    if (i < intentos) await new Promise(r => setTimeout(r, 1500 * i))
  }
  return null
}

export default {
  command:     ['play2'],
  tag:         'play2',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga el video de YouTube (nombre o URL)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar el nombre o la URL del video.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    const ytRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = input.match(ytRegex)

    let videoUrl

    try {
      if (match) {
        videoUrl = `https://youtu.be/${match[1]}`
      } else {
        const search = await ytSearch(input)
        if (!search.videos?.length) {
          await sock.sendMessage(from, { text: 'no encontré nada con ese nombre... no es que me haya esforzado mucho, ¿eh?' }, { quoted: msg })
          return
        }
        videoUrl = search.videos[0].url.split('&')[0]
      }
    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
      return
    }

    try {
      const api = `https://api.lempi.lat/dl/ytv?url=${encodeURIComponent(videoUrl)}&apikey=${API_KEY}`

      const res = await fetchConReintentos(api, { headers: { 'content-type': 'application/json' } })
      if (!res) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const data = await res.json()

      if (!data.status || !data.datos?.url) {
        await sock.sendMessage(from, { text: 'no pude obtener el video... qué fastidio.' }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { text: 'estoy descargando el video, tenga paciencia.' }, { quoted: msg })

      const dl = await fetchConReintentos(data.datos.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      })

      if (!dl) {
        await sock.sendMessage(from, { text: 'falló la descarga... no es mi culpa, ¿eh?' }, { quoted: msg })
        return
      }

      const buffer = Buffer.from(await dl.arrayBuffer())
      const fileName = data.datos.archivo || `${data.titulo || 'video'}.mp4`

      await sock.sendMessage(from, {
        document: buffer,
        mimetype: 'video/mp4',
        fileName,
        caption: data.titulo || '',
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}