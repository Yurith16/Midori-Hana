import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['eevee', 'tierno', 'cute'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'eevee'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de ojitos brillantes
    await sock.sendMessage(from, { react: { text: '🥺', key: msg.key } })

    try {
      // Usamos la URL directa del video que proporcionaste
      const videoUrl = `http://cdn.delirius.store/v2/reaction/sfw/eevee/PpHuCB0.mp4`

      // 4. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Compartiendo ternura con alguien
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Evolución de amor!* @${selfTag} le está contagiando toda la ternura de Eevee a @${victimTag}... ✨🐾💖`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Momento tierno individual
        const frasesRandom = [
          `*¡Eevee salvaje aparece!* @${selfTag} se puso en modo ultra tierno sin avisar. 🐾✨`,
          `@${selfTag} está irradiando pura dulzura hoy... ¡Miren qué lindo se ve! 🌸🥺`,
          `*Sin contexto:* @${selfTag} decidió que hoy es un día para ser adorable. 🍬✨`,
          `@${selfTag} activó su modo Eevee. ¡Imposible no querer darle un abrazo! 🧸💖`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif de Eevee
      const enviado = await sock.sendMessage(from, {
        video: { url: videoUrl },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Estrellas o huellita
        await sock.sendMessage(from, { react: { text: targetJid ? '💖' : '🐾', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}