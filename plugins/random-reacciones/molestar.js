import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['bully', 'molestar', 'humillar'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'bully'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de "malicia"
    await sock.sendMessage(from, { react: { text: '😈', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/bully`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Bullying dirigido
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡F por @${victimTag}!* @${selfTag} lo está agarrando de bajada... ¡No le tengan piedad! 😈🔥👊`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Auto-Bullying (Sin contexto)
        const frasesRandom = [
          `*¿Auto-Bullying?* @${selfTag} se está molestando a sí mismo porque no tiene a quién más molestar. 🤡📉`,
          `@${selfTag} se está humillando solo sin contexto alguno... ¡Qué triste situación! 🙊💔`,
          `*Momento de crisis:* @${selfTag} empezó a hacerse bully solito. ¿Ocupas un abrazo? 🫂📉`,
          `*Nivel de soledad:* @${selfTag} se está molestando a sí mismo para no sentirse ignorado. 😈🤣`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con el drama
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Risa si es a otro, o payaso si es solo
        await sock.sendMessage(from, { react: { text: targetJid ? '🤣' : '🤡', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}