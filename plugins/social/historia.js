import axios from 'axios'

export default {
  command: ['historia', 'cuento', 'story'],
  execute: async (sock, msg, { from, args }) => {
    // Si no escribe un tema, le asignamos uno por defecto
    const tema = args.join(' ') || 'aventura'

    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/historia/generar', 
        { tema: tema }, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data

      // Diseño limpio: Título basado en el tema solicitado
      const txt = `> *HISTORIA:* ${tema.toUpperCase()}\n\n` +
                  `${info.historia}`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}