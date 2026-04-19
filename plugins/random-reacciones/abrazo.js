import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['abrazar', 'cuddle', 'abrazo'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'acurrucar'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de amor
    await sock.sendMessage(from, { react: { text: '🫂', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/cuddle`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Acurrucándose con alguien (Puro drama romántico)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Qué romántico!* @${selfTag} se acurrucó tiernamente con @${victimTag}... El tiempo se detuvo para ellos. ✨🧸💖`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Buscando afecto sin contexto (Humor solitario)
        const frasesRandom = [
          `*¡Alerta de soledad!* @${selfTag} se está acurrucando con su almohada porque nadie le hace caso... 🧸💔`,
          `@${selfTag} anda buscando un abracito desesperadamente. ¿Alguien se ofrece? 🫂✨`,
          `*Sin contexto:* @${selfTag} se acurrucó con el aire. El drama de la soltería es real. ✨🤡`,
          `@${selfTag} entró en modo cariñoso, pero no encontró a nadie... ¡Qué triste! 🥺🍃`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con la ternura
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Oso de peluche o brillos
        await sock.sendMessage(from, { react: { text: targetJid ? '💖' : '🧸', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}