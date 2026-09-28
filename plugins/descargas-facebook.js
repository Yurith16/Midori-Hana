const API_KEY = 'lem_c92ba8f5ed716cd9d1ba968623728690dc706dcb'
const LIMITE_MB = 50

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
  command:     ['fb', 'facebook'],
  tag:         'facebook',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga videos de Facebook (URL)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar la URL del video de Facebook.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    const fbRegex = /https?:\/\/(www\.|web\.|m\.)?facebook\.com\/[^\s]+/
    const match = input.match(fbRegex)

    if (!match) {
      await sock.sendMessage(from, { text: 'eso no parece una URL de Facebook...' }, { quoted: msg })
      return
    }

    const postUrl = match[0]

    try {
      const api = `https://api.lempi.lat/dl/facebook?url=${encodeURIComponent(postUrl)}&quality=hd&apikey=${API_KEY}`

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
      const fileName = data.datos.archivo || `${data.id || 'facebook'}.mp4`
      const pesoMB = buffer.length / (1024 * 1024)
      const caption = data.titulo || ''

      if (pesoMB > LIMITE_MB) {
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: 'video/mp4',
          fileName,
          caption,
        }, { quoted: msg })
      } else {
        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          caption,
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}