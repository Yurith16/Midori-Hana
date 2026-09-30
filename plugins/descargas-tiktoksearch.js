import axios from 'axios'

const API_KEY = 'lem_c92ba8f5ed716cd9d1ba968623728690dc706dcb'
const MAX_VIDEOS = 5

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

export default {
  command:     ['tiktoksearch', 'ttsearch', 'tts', 'tks'],
  tag:         'tiktoksearch',
  categoria:   'media',
  owner:       false,
  group:       false,
  descripcion: 'Busca videos en TikTok y los envía',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    const query = args.join(' ').trim()
    if (!query) {
      await sock.sendMessage(from, { text: 'debes ingresar un término de búsqueda.' }, { quoted: msg })
      return
    }

    try {
      console.log('[tts] query:', query)

      const apiUrl = `https://api.lempi.lat/s/tiktok?q=${encodeURIComponent(query)}&count=10&apikey=${API_KEY}`
      const res = await fetchConReintentos(apiUrl, { headers: { 'content-type': 'application/json' } })

      if (!res) {
        console.log('[tts] búsqueda falló')
        await sock.sendMessage(from, { text: 'la búsqueda falló...' }, { quoted: msg })
        return
      }

      const data = await res.json()
      const resultados = data?.resultados || []

      console.log('[tts] resultados:', resultados.length)

      if (!resultados.length) {
        await sock.sendMessage(from, { text: 'no se encontraron videos para tu búsqueda.' }, { quoted: msg })
        return
      }

      const seleccionados = resultados.slice(0, MAX_VIDEOS)
      let enviados = 0

      for (let i = 0; i < seleccionados.length; i++) {
        const video = seleccionados[i]
        try {
          const videoUrl = video.video
          if (!videoUrl) {
            console.log(`[tts] video ${i + 1}: sin url`)
            continue
          }

          console.log(`[tts] video ${i + 1}: descargando`, videoUrl)

          const videoRes = await fetchConReintentos(videoUrl, {
            headers: {
              'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
              'accept': '*/*',
              'referer': 'https://api.lempi.lat/'
            },
            redirect: 'follow'
          })

          if (!videoRes) {
            console.log(`[tts] video ${i + 1}: descarga falló`)
            continue
          }

          const buffer = Buffer.from(await videoRes.arrayBuffer())
          console.log(`[tts] video ${i + 1}: buffer ${buffer.length} bytes`)

          await sock.sendMessage(from, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: video.titulo || ''
          }, { quoted: msg })

          console.log(`[tts] video ${i + 1}: enviado`)
          enviados++

        } catch (e) {
          console.log(`[tts] video ${i + 1} error:`, e.message)
          continue
        }
      }

      console.log('[tts] total enviados:', enviados)

      if (enviados === 0) {
        await sock.sendMessage(from, { text: 'no se pudo descargar ningún video.' }, { quoted: msg })
      }

    } catch (e) {
      console.log('[tts] error general:', e)
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}