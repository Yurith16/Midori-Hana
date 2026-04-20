import axios from 'axios'

export default {
  command: ['lyrics', 'letra', 'lyric'],
  execute: async (sock, msg, { from, args }) => {
    if (!args[0]) return sock.sendMessage(from, { text: `> *Ingrese el nombre de una canción* 🎵` }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/letras/buscar', 
        { query: args.join(' ') },
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data
      // Formato: > Título de la música (sin prefijos de 'Nombre:' ni artista)
      const txt = `> *${info.titulo}*\n\n` +
                  `${info.letra}`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}