import axios from 'axios'

export default {
  command: ['curiosidad', 'dato', 'curiosity'],
  execute: async (sock, msg, { from }) => {
    // Reacción de plantita al iniciar
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/curiosidad/generar', 
        {}, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data

      // Formato minimalista: > Tema y el dato abajo
      const txt = `> *SABÍAS QUE...* (${info.tema})\n\n` +
                  `${info.curiosidad}`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      // Reacción de advertencia si falla la API
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}