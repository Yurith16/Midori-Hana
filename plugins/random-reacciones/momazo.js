import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['bonk', 'mazazo', 'martillazo'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'bonk'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de "prepárate para el golpe"
    await sock.sendMessage(from, { react: { text: '🔨', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/bonk`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Bonk dirigido (Justicia grupal)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡BONK!* @${selfTag} le dio un tremendo mazazo a @${victimTag}... ¡Directo a la horny jail! 🔨💥🚫`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Bonk sin contexto (Humor aleatorio)
        const frasesRandom = [
          `*¡Auto-Bonk!* @${selfTag} se dio un martillazo solo para ver si se le quitaba lo raro. 🔨🥴`,
          `@${selfTag} se dio un bonk sin contexto... ¡Alguien quítele el martillo! 🔨🤣`,
          `*¡PUM!* @${selfTag} se pegó solito en la cabeza. ¿Todo bien en casa? 🔨💥`,
          `*Momento de reflexión:* @${selfTag} se dio un bonk para dejar de pensar tonterías. 🔨🧠`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif con el drama del golpe
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Cárcel si es a otro, o mareo si es solo
        await sock.sendMessage(from, { react: { text: targetJid ? '🚫' : '💫', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}