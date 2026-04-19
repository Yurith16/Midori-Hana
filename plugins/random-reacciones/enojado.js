import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['enojado', 'angry', 'mad'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 2. Reacción inicial de molestia (el aviso antes de la explosión)
    await sock.sendMessage(from, { react: { text: '😠', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/angry`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 3. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Furia dirigida (Drama total)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡CORRAN!* @${selfTag} perdió la paciencia con @${victimTag}... ¡Que alguien los separe! 😡💢🔥`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Furia general (Explosión solitaria)
        txt = `*¡CUIDADO!* @${selfTag} está que explota de rabia... ¡Mejor no digan nada! 🤬💢💥`
      }

      // 4. Enviar el video/gif con el drama del enojo
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final de furia total
        await sock.sendMessage(from, { react: { text: '🔥', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}