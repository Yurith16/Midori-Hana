import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['sonrojar', 'blush', 'penita', 'tímido'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'sonrojar'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de ternura
    await sock.sendMessage(from, { react: { text: '😊', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/blush`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Alguien más causó el sonrojo
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Ay, qué lindo!* @${selfTag} se sonrojó por culpa de @${victimTag}... ¡Hay amor en el grupo! 😊💖✨`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Sonrojo sin contexto (Humor aleatorio)
        const frasesRandom = [
          `*¡Qué tierno!* @${selfTag} se puso rojo como un tomate sin ninguna razón aparente... 😊🍅`,
          `@${selfTag} anda de tímido hoy. ¿Quién le habrá dicho algo lindo? ✨😳`,
          `*Momento de timidez:* @${selfTag} se sonrojó solito... ¡Se nota que tiene un secreto! 🤫💕`,
          `*¡Alerta de ternura!* @${selfTag} está sintiendo mucha penita ahora mismo. 😊🌸`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con el drama del sonrojo
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Destellos si es general, o corazón si es hacia alguien
        await sock.sendMessage(from, { react: { text: targetJid ? '💌' : '✨', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}