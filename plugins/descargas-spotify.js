const BASE = 'https://spotsaver.net'
const COOKIE = '__cf_bm=qW81c27w3CxcwM3bq4KFOAGzNI44hiPXfYAsVYo9pZw-1790612006.501612-1.0.1.1-5jlDVeWIRgrdq7.ne1mLUJdVtAKVZVh0p6kapLTiHhGPAQQygb197VTF4KyE0ne.PPuSut2dtx3Wy4LS7fGNHCf6hMQWw75x73Fz8mK_J3FxXK4aqLv.S8dUWCwNkIBD'
const EXPIRA_MS = 5 * 60 * 1000

if (!global.spPending) global.spPending = new Map()

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

function headersBase() {
  return {
    'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    'accept': '*/*',
    'accept-language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    'referer': BASE + '/results/',
    'origin': BASE,
    'cookie': COOKIE
  }
}

async function descargarCancion(sock, msg, from, elegido) {
  const titulo = elegido.title || elegido.titulo || elegido.name
  const artista = elegido.artist || elegido.artista || (elegido.artists?.[0]?.name) || ''

  await sock.sendMessage(from, { text: `descargando *${titulo}${artista ? ' - ' + artista : ''}*...` }, { quoted: msg })

  const idRes = await fetchConReintentos(`${BASE}/api/get-id/`, {
    method: 'POST',
    headers: { ...headersBase(), 'content-type': 'application/json' },
    body: JSON.stringify({ title: titulo, artist: artista })
  })
  if (!idRes) {
    await sock.sendMessage(from, { text: 'no pude obtener el id del video...' }, { quoted: msg })
    return
  }

  const idData = await idRes.json()
  const videoId = idData?.videoId
  if (!videoId) {
    await sock.sendMessage(from, { text: 'la api no devolvió videoId.' }, { quoted: msg })
    return
  }

  const dlRes = await fetchConReintentos(`${BASE}/api/download/`, {
    method: 'POST',
    headers: { ...headersBase(), 'content-type': 'application/json' },
    body: JSON.stringify({
      videoId,
      candidateIds: [],
      format: 'mp3',
      title: `${titulo} - ${artista}`,
      licenseKey: null
    })
  })
  if (!dlRes) {
    await sock.sendMessage(from, { text: 'no pude obtener el enlace de descarga...' }, { quoted: msg })
    return
  }

  const dlData = await dlRes.json()
  const mediaUrl = dlData?.mediaUrl || dlData?.url || dlData?.downloadUrl
  const fileName = dlData?.filename || `${titulo} - ${artista}.mp3`

  if (!mediaUrl) {
    await sock.sendMessage(from, { text: 'la api no devolvió enlace de audio.' }, { quoted: msg })
    return
  }

  const audioRes = await fetchConReintentos(mediaUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'referer': BASE + '/',
      'cookie': COOKIE
    },
    redirect: 'follow'
  })
  if (!audioRes) {
    await sock.sendMessage(from, { text: 'falló la descarga... inténtalo de nuevo.' }, { quoted: msg })
    return
  }

  const buffer = Buffer.from(await audioRes.arrayBuffer())

  await sock.sendMessage(from, {
    document: buffer,
    mimetype: 'audio/mpeg',
    fileName
  }, { quoted: msg })

  await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
}

export default {
  command:     ['spotify', 'sp'],
  tag:         'spotify',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Busca en Spotify y descarga la canción elegida (mp3)',

  async onMessage(sock, msg, { from, text, userNum }) {
    const limpio = (text || '').trim()
    if (!/^\d{1,2}$/.test(limpio)) return

    const key = `${from}:${userNum}`
    const pendiente = global.spPending.get(key)

    if (!pendiente) return
    if (Date.now() - pendiente.ts > EXPIRA_MS) {
      global.spPending.delete(key)
      return
    }

    const idx = parseInt(limpio) - 1
    const elegido = pendiente.items[idx]

    if (!elegido) {
      await sock.sendMessage(from, { text: 'ese número no está en la lista.' }, { quoted: msg })
      return
    }

    global.spPending.delete(key)

    try {
      await descargarCancion(sock, msg, from, elegido)
    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  },

  async execute(sock, msg, { from, args, userNum }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar el nombre de la canción.' }, { quoted: msg })
      return
    }

    const query = args.join(' ').trim()

    try {
      const res = await fetchConReintentos(
        `${BASE}/api/spotify/?q=${encodeURIComponent(query)}`,
        { headers: headersBase() }
      )
      if (!res) {
        await sock.sendMessage(from, { text: 'la búsqueda falló...' }, { quoted: msg })
        return
      }

      const data = await res.json()
      const items = data?.items || data?.results || data?.tracks || data?.canciones

      if (!items || !items.length) {
        await sock.sendMessage(from, { text: 'no encontré nada con ese nombre...' }, { quoted: msg })
        return
      }

      const top10 = items.slice(0, 10)

      let lista = `*Resultados para:* ${query}\n\n`
      top10.forEach((r, i) => {
        const t = r.title || r.titulo || r.name || '?'
        const a = r.artist || r.artista || (r.artists?.[0]?.name) || ''
        lista += `${i + 1}. ${t}${a ? ' - ' + a : ''}\n`
      })
      lista += `\nresponde con el número de la que quieras descargar.`

      global.spPending.set(`${from}:${userNum}`, {
        items: top10,
        ts: Date.now()
      })

      await sock.sendMessage(from, { text: lista }, { quoted: msg })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}