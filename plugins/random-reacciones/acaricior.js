import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['acariciar', 'pat'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el comando para el texto
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'acariciar'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de ternura
    await sock.sendMessage(from, { react: { text: '🫂', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/pat`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Acariciando a alguien (Consuelo o amor)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Qué tierno!* @${selfTag} está acariciando la cabecita de @${victimTag}... Todo estará bien. ✨💖🖐️`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Auto-pat (Humor solitario)
        const frasesRandom = [
          `*Momento de soledad:* @${selfTag} se acaricia a sí mismo porque nadie más lo hace... 🥺🖐️`,
          `@${selfTag} se está dando ánimos solito. ¡Tú puedes con todo! ✨🧸`,
          `*Sin contexto:* @${selfTag} se dio un "pat" en la cabeza por ser un buen chico/a. 😊🌸`,
          `@${selfTag} está buscando mimos en el aire. ¿Alguien que lo acaricie? 🫂✨`
        ]
        txt = frasesRandom[Math.floor(Math.random() * frasesRandom.length)]
      }

      // 5. Enviar el video/gif
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Brillos o mano
        await sock.sendMessage(from, { react: { text: targetJid ? '✨' : '🥺', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}