import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['feliz', 'happy', 'alegre'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'feliz'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de alegría radiante
    await sock.sendMessage(from, { react: { text: '😁', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/happy`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Compartiendo la felicidad (Drama positivo)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Felicidad pura!* @${selfTag} está celebrando junto a @${victimTag}... ¡Qué alegría verlos así! ✨🥳💖`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Felicidad individual (Humor alegre)
        const frasesRandom = [
          `*¡Día increíble!* @${selfTag} se siente la persona más feliz del mundo hoy. 🌈✨`,
          `@${selfTag} anda con una sonrisa que no le cabe en la cara. ¡Contagia esa vibra! 😁⭐`,
          `*Sin contexto:* @${selfTag} simplemente decidió ser feliz y el grupo lo sabe. 🎊💃`,
          `*¡Alerta de gozo!* @${selfTag} está irradiando pura felicidad... ¡Nada puede salir mal! 🥳🔥`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con la alegría
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Confeti o Sol
        await sock.sendMessage(from, { react: { text: targetJid ? '🎊' : '☀️', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}