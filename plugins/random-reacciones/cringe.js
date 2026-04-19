import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['cringe', 'pena', 'asco'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 2. Reacción inicial de incomodidad
    await sock.sendMessage(from, { react: { text: '😵‍💫', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/cringe`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 3. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Cringe hacia alguien más
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡DIOS MÍO!* @${selfTag} está sintiendo un nivel de cringe extremo por lo que hizo @${victimTag}... 🤮💀`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: El cringe es general o personal
        txt = `*Nivel de Cringe: 100%* @${selfTag} no puede con tanta pena ajena... ¡Alguien borre eso! 😬🤢`
      }

      // 4. Enviar el video/gif
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final de asco total
        await sock.sendMessage(from, { react: { text: '🤮', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}