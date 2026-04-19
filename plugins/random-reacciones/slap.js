import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['cachetada', 'slap', 'bofetada'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'cachetada'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de "prepárate"
    await sock.sendMessage(from, { react: { text: '😤', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/slap`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Ubicando a alguien más (Drama dirigido)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡REACCIONA!* @${selfTag} le dio una bofetada épica a @${victimTag} para que se ubique... ¡Eso sonó fuerte! ✋💥🔥`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Cachetada sin contexto (Humor aleatorio)
        const frasesRandom = [
          `*¡POV:* Te das una cachetada sin contexto! @${selfTag} perdió el sentido y se pegó solito. 🤦‍♂️💥`,
          `*¿Todo bien?* @${selfTag} se dio una bofetada a sí mismo solo porque tenía ganas de sentir el drama. ✋🤡`,
          `@${selfTag} se dio un golpe en la cara porque no puede creer lo que acaba de leer... ¡Ubícate! 😤✨`,
          `*Momento épico:* @${selfTag} se dio una cachetada sin razón alguna. ¡Reacciona, hombre! 💥🤕`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con el drama de la bofetada
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Rayo si es a otro, o duda si es solo
        await sock.sendMessage(from, { react: { text: targetJid ? '⚡' : '🤔', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}