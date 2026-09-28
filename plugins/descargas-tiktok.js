export default {
  command:     ['playtt', 'tt', 'tiktok'],
  tag:         'tiktok',
  categoria:   'descargas',
  owner:       false,
  group:       false,
  descripcion: 'Descarga video de TikTok',

  async execute(sock, msg, { from, args }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

    if (!args.length) {
      await sock.sendMessage(from, { text: 'debes ingresar el link de TikTok.' }, { quoted: msg })
      return
    }

    const input = args.join(' ').trim()
    if (!/tiktok\.com|vt\.tiktok\.com/i.test(input)) {
      await sock.sendMessage(from, { text: 'eso no parece un link de TikTok... ¿seguro que lo copiaste bien?' }, { quoted: msg })
      return
    }

    try {
      const apiKey = 'lem_c92ba8f5ed716cd9d1ba968623728690dc706dcb'
      const api = `https://api.lempi.lat/dl/tiktok?url=${encodeURIComponent(input)}&apikey=${apiKey}`

      const res = await fetch(api, { headers: { 'content-type': 'application/json' } })

      if (!res.ok) {
        await sock.sendMessage(from, { text: 'la api no respondió bien... inténtalo luego.' }, { quoted: msg })
        return
      }

      const data = await res.json()

      if (!data.status || !data.datos?.url) {
        await sock.sendMessage(from, { text: 'no encontré el video... qué fastidio.' }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { text: 'estoy descargando su video, tenga paciencia.' }, { quoted: msg })

      const dl = await fetch(data.datos.url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
        },
      })

      if (!dl.ok) {
        await sock.sendMessage(from, { text: 'falló la descarga... no es mi culpa, ¿eh?' }, { quoted: msg })
        return
      }

      const buffer = Buffer.from(await dl.arrayBuffer())
      const mb = buffer.length / (1024 * 1024)

      if (mb > 80) {
        await sock.sendMessage(from, { text: `el video pesa ${mb.toFixed(1)}MB, es demasiado grande para enviarlo por aquí.` }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, {
        video: buffer,
        mimetype: 'video/mp4',
        fileName: data.datos.archivo || `tiktok_${Date.now()}.mp4`,
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      await sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}