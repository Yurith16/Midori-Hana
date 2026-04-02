import axios from 'axios'
import '../../config.js'

export default {
  command: ['maid'],
  execute: async (sock, msg, { from }) => {
    await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/anime/maid`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      const enviado = await sock.sendMessage(from, {
        image: { url: res.data.image }
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '💖', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}