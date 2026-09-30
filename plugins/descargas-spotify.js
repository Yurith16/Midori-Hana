import axios from 'axios'
import sharp from 'sharp'

const BASE = 'https://spotsaver.net'
const COOKIE = '__cf_bm=qW81c27w3CxcwM3bq4KFOAGzNI44hiPXfYAsVYo9pZw-1790612006.501612-1.0.1.1-5jlDVeWIRgrdq7.ne1mLUJdVtAKVZVh0p6kapLTiHhGPAQQygb197VTF4KyE0ne.PPuSut2dtx3Wy4LS7fGNHCf6hMQWw75x73Fz8mK_J3FxXK4aqLv.S8dUWCwNkIBD'

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

export default {
  command:     ['spotify', 'sp'],
  tag:         'spotify',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Busca en Spotify y descarga la primera canción (mp3)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar el nombre de la canción.' }, { quoted: msg })
      return
    }

    const query = args.join(' ').trim()

    try {
      // 1) Búsqueda
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

      const elegido = items[0]
      const titulo = elegido.title || elegido.titulo || elegido.name || '?'
      const artista = elegido.artist || elegido.artista || (elegido.artists?.[0]?.name) || ''
      const album = elegido.album?.nombre || elegido.album?.name || elegido.album || 'desconocido'
      const durationMs = elegido.duration_ms || elegido.duration
      const duration = durationMs
        ? `${Math.floor(durationMs / 60000)}:${String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}`
        : '--'
      const thumbnail = elegido.thumbnail || elegido.album?.imagen || elegido.image

      // ─── Portada + detalles ANTES ───
      const emojis = ['🌴', '🌱', '🦋', '🐛', '🐝']
      const emo = emojis[0]

      const detalles = `> *${titulo}${artista ? ' - ' + artista : ''}*\n\n` +
        `> ${emo} *Artista:* ${artista || 'desconocido'}\n` +
        `> ${emo} *Álbum:* ${album}\n` +
        `> ${emo} *Duración:* ${duration}`

      if (thumbnail) {
        try {
          const thumbRes = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 10000 })
          const thumbBuffer = await sharp(Buffer.from(thumbRes.data))
            .resize(480, 480)
            .jpeg({ quality: 80 })
            .toBuffer()

          await sock.sendMessage(from, {
            image:   thumbBuffer,
            caption: detalles
          }, { quoted: msg })
        } catch {
          await sock.sendMessage(from, { text: detalles }, { quoted: msg })
        }
      } else {
        await sock.sendMessage(from, { text: detalles }, { quoted: msg })
      }

      // ─── 2) Descarga ───
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

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}