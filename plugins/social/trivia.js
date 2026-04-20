import axios from 'axios'

// Usamos global para que la memoria persista entre recargas
if (!global.trivias) global.trivias = {}

export default {
  command: ['trivia', 'pregunta'],
  execute: async (sock, msg, { from, args }) => {
    const tema = args.join(' ') || 'cultura general'
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/trivia/generar', 
        { tema: tema }, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data) throw new Error()

      const { pregunta, opciones, correcta, explicacion } = res.data

      // Si ya había una trivia, la limpiamos antes de empezar otra
      if (global.trivias[from]) clearTimeout(global.trivias[from].timer)

      // Guardamos datos y configuramos el tiempo límite
      global.trivias[from] = {
        respuesta: correcta.toLowerCase().trim(),
        explicacion: explicacion,
        timer: setTimeout(async () => {
          if (global.trivias[from]) {
            await sock.sendMessage(from, { text: `> *TIEMPO AGOTADO* ⏱️\n\nNadie respondió a tiempo. La respuesta era: *${correcta.toUpperCase()}*` })
            delete global.trivias[from]
          }
        }, 30000) // 30 segundos
      }

      let txt = `*${pregunta}*\n\n`

      Object.entries(opciones).forEach(([letra, texto]) => {
        txt += `*${letra.toUpperCase()}*) ${texto}\n`
      })

      txt += `\n> _Tienes 30 segundos y 1 sola oportunidad_`

      await sock.sendMessage(from, { text: txt }, { quoted: msg })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  },

  onMessage: async (sock, msg, { from, text }) => {
    if (!global.trivias || !global.trivias[from] || text.length > 2) return 

    const userAns = text.toLowerCase().trim()
    const { respuesta, explicacion, timer } = global.trivias[from]

    if (/^[a-d]$/.test(userAns)) {
      // Cancelamos el temporizador porque ya hubo una respuesta
      clearTimeout(timer)

      if (userAns === respuesta) {
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
        const txt = `> *¡CORRECTO!* 🎉\n\n${explicacion}`
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
      } else {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        const txt = `> *¡INCORRECTO!* 💀\n\nLa respuesta era la *${respuesta.toUpperCase()}*.\nPerdiste tu oportunidad.`
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
      }

      delete global.trivias[from]
    }
  }
}