import axios from 'axios'
import '../../config.js'

export default {
  command: ['lolipc'],
  execute: async (sock, msg, { from }) => {
    await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/anime/lolipc`
      
      const enviado = await sock.sendMessage(from, {
        image: { url: apiUrl }
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '💖', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}