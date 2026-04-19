import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['mimo', 'esponjoso', 'ternura', 'mimos'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'fluff'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de "nube de azúcar"
    await sock.sendMessage(from, { react: { text: '☁️', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/fluff`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Momento fluff con alguien (Más drama de amor)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Dosis de ternura!* @${selfTag} se puso súper cariñoso con @${victimTag}... ¡Es demasiado fluff para este grupo! ✨☁️💖`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Fluff sin contexto (Humor tierno)
        const frasesRandom = [
          `*¡Alerta de azúcar!* @${selfTag} anda en modo esponjoso sin ninguna razón. ¡Qué lindo! 🌸✨`,
          `@${selfTag} se siente como una nube hoy... ¡Pura ternura y mimos! ☁️🍭`,
          `*Sin contexto:* @${selfTag} está repartiendo vibras esponjosas a todo el que lea esto. ✨🧸`,
          `@${selfTag} entró en modo Fluff. ¡Cuidado, que su dulzura es contagiosa! 🍬🌸`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con el sentimiento
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Piruleta o destellos
        await sock.sendMessage(from, { react: { text: targetJid ? '🍭' : '✨', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}