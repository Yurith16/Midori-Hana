import axios from 'axios'

export default {
  command: ['frase', 'quote'],
  execute: async (sock, msg, { from }) => {
    // Reacción de plantita al iniciar
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/frase/generar', 
        {}, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data

      // Formato minimalista: > Frase y autor/tema
      const txt = `> *FRASE:* ${info.tema || 'Reflexión'}\n\n` +
                  `“${info.frase}”`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      // Reacción de advertencia si falla la API
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}