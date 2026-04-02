import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['cringe', 'pena', 'asco'],
  execute: async (sock, msg, { from }) => {
    // 1. Reacción inicial de "qué estoy viendo"
    await sock.sendMessage(from, { react: { text: '😬', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/cringe`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 2. Obtener el JID de quien usa el comando
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)

      // 3. Mensaje de drama: El usuario sintió el cringe en el alma
      const txt = `> *¡Qué pena ajena!* @${selfJid.split('@')[0]} acaba de morir de cringe... 😬🤮`

      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: [selfJid]
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '🤮', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}