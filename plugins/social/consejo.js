import axios from 'axios'

export default {
  command: ['consejo', 'advice'],
  execute: async (sock, msg, { from }) => {
    // Reacción de plantita al iniciar
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/consejo/generar', 
        {}, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data

      // Texto directo y limpio
      const txt = `> *CONSEJO:* ${info.tema}\n\n` +
                  `${info.consejo}`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      // Reacción de advertencia si algo falla
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}