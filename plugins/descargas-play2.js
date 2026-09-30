import ytSearch from 'yt-search'

const API_KEY = 'b69e9ac84c9c5f8a9f265c337a9005f3'
const AUTH_URL = 'https://gamma.gammacloud.net/api/v1/auth'
const INIT_URL = 'https://gamma.gammacloud.net/api/v1/init'
const MAX_INTENTOS_PROGRESS = 60
const DELAY_PROGRESS_MS = 2000

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
  command:     ['ytmp4'],
  tag:         'ytmp4',
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

      // 3) convert (1) con f=mp4
      const primeraConvertUrl = `${initData.convertURL}&v=${videoId}&f=mp4&_=${Date.now()}`
      const conv1Res = await fetchConReintentos(primeraConvertUrl, {
        headers: headersBase()
      })
      if (!conv1Res) {
        await sock.sendMessage(from, { text: 'no pude iniciar la conversión.' }, { quoted: msg })
        return
      }

      const conv1Data = await conv1Res.json()
      let downloadURL = conv1Data?.downloadURL
      let progressURL = conv1Data?.progressURL
      let titulo = conv1Data?.title || ''

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
        progressURL = conv2Data?.progressURL
        titulo = conv2Data?.title || titulo
      }

      if (!downloadURL) {
        await sock.sendMessage(from, { text: 'no pude obtener el video... prueba con otro.' }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { text: 'estoy convirtiendo el video, tenga paciencia.' }, { quoted: msg })

      // 5) polling hasta progress === 3
      if (progressURL) {
        for (let i = 1; i <= MAX_INTENTOS_PROGRESS; i++) {
          await new Promise(r => setTimeout(r, DELAY_PROGRESS_MS))

          const progUrl = progressURL.includes('_=')
            ? progressURL
            : `${progressURL}&_=${Date.now()}`

          const progRes = await fetchConReintentos(progUrl, { headers: headersBase() })
          if (!progRes) continue

          const progData = await progRes.json().catch(() => null)
          if (progData?.title) titulo = progData.title

          if (progData?.progress === 3) break
        }
      }

      if (!titulo) titulo = 'video'

      // 6) descarga final
      const finalUrl = downloadURL.includes('r=ytmp3.gl')
        ? downloadURL
        : `${downloadURL}&r=ytmp3.gl`

      const dlRes = await fetchConReintentos(finalUrl, {
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

      const buffer = Buffer.from(await dlRes.arrayBuffer())
      const fileName = `${titulo}.mp4`

      await sock.sendMessage(from, {
        document: buffer,
        mimetype: 'video/mp4',
        fileName,
        caption: titulo
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}