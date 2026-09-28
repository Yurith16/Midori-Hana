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
  command:     ['ig', 'instagram'],
  tag:         'instagram',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga video o imágenes de Instagram (URL)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar la URL del post o reel de Instagram.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    const igRegex = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/
    const match = input.match(igRegex)

    if (!match) {
      await sock.sendMessage(from, { text: 'eso no parece una URL de Instagram...' }, { quoted: msg })
      return
    }

    const postUrl = match[0]

    try {
      const api = `https://api.lempi.lat/dl/instagram?url=${encodeURIComponent(postUrl)}&apikey=${API_KEY}`

      const res = await fetchConReintentos(api, { headers: { 'content-type': 'application/json' } })
      if (!res) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const data = await res.json()

      if (!data.status || !data.datos) {
        await sock.sendMessage(from, { text: 'no pude obtener el contenido... qué fastidio.' }, { quoted: msg })
        return
      }

      const videos = data.datos.videos || []
      const imagenes = data.datos.imagenes || []
      const caption = data.metadata?.caption || ''

      if (!videos.length && !imagenes.length) {
        await sock.sendMessage(from, { text: 'no encontré contenido descargable en ese post.' }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { text: 'estoy descargando, tenga paciencia.' }, { quoted: msg })

      if (videos.length) {
        const dl = await fetchConReintentos(videos[0], {
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

        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          caption,
        }, { quoted: msg })

      } else {
        for (const img of imagenes) {
          const dl = await fetchConReintentos(img, {
            headers: {
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
          })

          if (!dl) continue

          const buffer = Buffer.from(await dl.arrayBuffer())

          await sock.sendMessage(from, {
            image: buffer,
            caption,
          }, { quoted: msg })
        }
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}