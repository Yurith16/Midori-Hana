import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['enojado', 'angry', 'mad'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Reacción inicial de molestia inmediata
    await sock.sendMessage(from, { react: { text: '😠', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/angry`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 2. Obtener el JID real de quien usa el comando
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)

      // 3. Mensaje directo: Solo menciona al autor del comando
      const txt = `> *¡Cuidado!* @${selfJid.split('@')[0]} está muy enojado ahora mismo... 😠💢`

      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: [selfJid]
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '💢', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}