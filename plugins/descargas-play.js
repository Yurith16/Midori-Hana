import ytSearch from 'yt-search'

const API_KEY = 'b69e9ac84c9c5f8a9f265c337a9005f3'
const AUTH_URL = 'https://gamma.gammacloud.net/api/v1/auth'
const INIT_URL = 'https://gamma.gammacloud.net/api/v1/init'

async function fetchConReintentos(url, opciones = {}, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(url, opciones)
      if (res.ok) return res
    } catch {}
    if (i < intentos) await new Promise(r => setTimeout(r, 1500 * i))
  }
  return null
}

function headersBase(referer = 'https://ytmp3.gl/') {
  return {
    'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    'accept': '*/*',
    'accept-language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    'referer': referer,
    'origin': 'https://ytmp3.gl'
  }
}

export default {
  command:     ['play'],
  tag:         'play',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga el audio de YouTube (nombre o URL)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar el nombre o la URL del video.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    const ytRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = input.match(ytRegex)

    let videoId

    try {
      if (match) {
        videoId = match[1]
      } else {
        const search = await ytSearch(input)
        if (!search.videos?.length) {
          await sock.sendMessage(from, { text: 'no encontré nada con ese nombre... no es que me haya esforzado mucho, ¿eh?' }, { quoted: msg })
          return
        }
        const urlVid = search.videos[0].url.split('&')[0]
        const idMatch = urlVid.match(/v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/)
        videoId = idMatch?.[1] || idMatch?.[2] || search.videos[0].videoId
      }
    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
      return
    }

    if (!videoId) {
      await sock.sendMessage(from, { text: 'no pude obtener el id del video.' }, { quoted: msg })
      return
    }

    try {
      console.log('[play] videoId:', videoId)

      // 1) auth
      const authRes = await fetchConReintentos(`${AUTH_URL}?api_key=${API_KEY}&_=${Date.now()}`, {
        headers: headersBase()
      })
      if (!authRes) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const authData = await authRes.json()
      if (!authData?.key) {
        await sock.sendMessage(from, { text: 'no pude autenticarme con la api.' }, { quoted: msg })
        return
      }

      console.log('[play] auth key:', authData.key)

      // 2) init
      const initRes = await fetchConReintentos(`${INIT_URL}?_=${Date.now()}`, {
        headers: { ...headersBase(), 'authorization': `Bearer ${authData.key}` }
      })
      if (!initRes) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const initData = await initRes.json()
      if (!initData?.convertURL) {
        await sock.sendMessage(from, { text: 'no pude obtener el enlace de conversión.' }, { quoted: msg })
        return
      }

      // 3) convert (1)
      const primeraConvertUrl = `${initData.convertURL}&v=${videoId}&f=mp3&_=${Date.now()}`
      const conv1Res = await fetchConReintentos(primeraConvertUrl, {
        headers: headersBase()
      })
      if (!conv1Res) {
        await sock.sendMessage(from, { text: 'no pude iniciar la conversión.' }, { quoted: msg })
        return
      }

      const conv1Data = await conv1Res.json()
      let downloadURL = conv1Data?.downloadURL
      let titulo = conv1Data?.title || ''

      console.log('[play] convert1 downloadURL:', downloadURL ? 'sí' : 'no', '| redirect:', !!conv1Data?.redirectURL)

      // 4) convert (2 — redirect) si aplica
      if (!downloadURL && conv1Data?.redirectURL) {
        const segundaUrl = conv1Data.redirectURL.includes('_=')
          ? conv1Data.redirectURL
          : `${conv1Data.redirectURL}&_=${Date.now()}`

        const conv2Res = await fetchConReintentos(segundaUrl, {
          headers: headersBase()
        })
        if (!conv2Res) {
          await sock.sendMessage(from, { text: 'falló la conversión...' }, { quoted: msg })
          return
        }

        const conv2Data = await conv2Res.json()
        downloadURL = conv2Data?.downloadURL
        titulo = conv2Data?.title || titulo

        console.log('[play] convert2 downloadURL:', downloadURL ? 'sí' : 'no')
      }

      if (!downloadURL) {
        await sock.sendMessage(from, { text: 'no pude obtener el audio... prueba con otro.' }, { quoted: msg })
        return
      }

      if (!titulo) titulo = 'audio'

      await sock.sendMessage(from, { text: 'estoy descargando su audio, tenga paciencia.' }, { quoted: msg })

      // 5) descarga
      const dlRes = await fetchConReintentos(downloadURL, {
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'referer': 'https://ytmp3.gl/'
        },
        redirect: 'follow'
      })

      if (!dlRes) {
        await sock.sendMessage(from, { text: 'falló la descarga... no es mi culpa, ¿eh?' }, { quoted: msg })
        return
      }

      console.log('[play] dl status:', dlRes.status)
      console.log('[play] dl content-length:', dlRes.headers.get('content-length'))
      console.log('[play] dl content-type:', dlRes.headers.get('content-type'))

      const buffer = Buffer.from(await dlRes.arrayBuffer())
      console.log('[play] buffer size:', buffer.length)

      const fileName = `${titulo}.mp3`

      await sock.sendMessage(from, {
        document: buffer,
        mimetype: 'audio/mpeg',
        fileName
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (e) {
      console.log('[play] error:', e)
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}