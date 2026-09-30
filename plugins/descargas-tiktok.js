const CNVMP3 = 'https://cnvmp3.com'

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
  command:     ['tiktok', 'tt'],
  tag:         'tiktok',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga un video de TikTok (URL)',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar la URL del video de TikTok.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    const ttRegex = /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/
    const match = input.match(ttRegex)

    if (!match) {
      await sock.sendMessage(from, { text: 'eso no parece una URL de TikTok...' }, { quoted: msg })
      return
    }

    const url = match[0]

    try {
      const res = await fetchConReintentos(`${CNVMP3}/fetch.php`, {
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
          'accept': 'application/json',
          'accept-language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
          'referer': 'https://cnvmp3.com/v55',
          'origin': 'https://cnvmp3.com',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          url,
          downloadMode: 'auto',
          filenameStyle: 'basic',
          audioBitrate: '96'
        })
      })

      if (!res) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const data = await res.json()

      if (!data.url) {
        await sock.sendMessage(from, { text: 'no pude obtener el video... qué fastidio.' }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { text: 'estoy descargando el video, tenga paciencia.' }, { quoted: msg })

      const dl = await fetchConReintentos(data.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'referer': 'https://cnvmp3.com/'
        },
        redirect: 'follow'
      })

      if (!dl) {
        await sock.sendMessage(from, { text: 'falló la descarga... no es mi culpa, ¿eh?' }, { quoted: msg })
        return
      }

      const buffer = Buffer.from(await dl.arrayBuffer())
      const fileName = data.filename || 'tiktok.mp4'

      await sock.sendMessage(from, {
        video: buffer,
        mimetype: 'video/mp4',
        fileName,
        caption: ''
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}