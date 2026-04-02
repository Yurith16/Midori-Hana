import axios from 'axios'
import '../../config.js'

export default {
  command: ['ia'],
  execute: async (sock, msg, { args, from, text }) => {
    try {
      const consulta = text || args.join(' ')
      
      if (!consulta || consulta.trim() === "") {
        return sock.sendMessage(from, { text: '`🍃` *¿En qué puedo ayudarte hoy?*' }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })

      const apiUrl = `https://api.delirius.store/ia/chatgpt?q=${encodeURIComponent(consulta)}`
      const { data: res } = await axios.get(apiUrl)

      const respuestaIA = res.data || res.result

      if (!respuestaIA) throw new Error('Sin respuesta')

      // Diseño con hojitas y formato de cita alineado
      const responseTemplate = `
> 🍃 *𝐆𝐄𝐌𝐈𝐍𝐈 𝐀𝐈*
> 
> ${respuestaIA.trim().split('\n').join('\n> ')}
> 
> 🍃 ${global.botName || '© kari'}`.trim()

      await sock.sendMessage(from, { text: responseTemplate }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('Error GPT:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}