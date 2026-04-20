import axios from 'axios'

export default {
  command: ['horoscopo', 'zodiaco', 'signo'],
  execute: async (sock, msg, { from, args }) => {
    const signo = args[0]?.toLowerCase()
    const signosValidos = ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis']

    // Validar que ingrese un signo
    if (!signo || !signosValidos.includes(signo)) {
      return sock.sendMessage(from, { 
        text: `> *Ingrese un signo zodiacal válido* ♈\n\n*Ejemplo:* .horoscopo leo\n\n${signosValidos.join(', ')}` 
      }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/horoscopo/obtener', 
        { signo: signo }, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const info = res.data

      // Diseño limpio y directo
      const txt = `> *HORÓSCOPO:* ${signo.toUpperCase()}\n\n` +
                  `${info.horoscopo}`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}