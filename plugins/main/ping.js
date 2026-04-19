import config from '../../config.js'

export default {
  command: ['ping', 'p'],
  execute: async (sock, msg, { from }) => {
    // Calculamos la diferencia entre el 'ahora' y cuando se envió el mensaje
    const latency = Date.now() - (msg.messageTimestamp * 1000)

    const mensaje = `> 🏓 *PONG:* ${latency}ms`

    await sock.sendMessage(from, { text: mensaje }, { quoted: msg })
  }
}