import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['morder', 'bite'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos prefijo y comando manualmente
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'morder'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial
    await sock.sendMessage(from, { react: { text: '🫦', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/bite`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Mordiendo a alguien (Drama compartido)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]
        txt = `*¡Ouch!* @${selfTag} mordió a @${victimTag}... ¿Fue con cariño o con hambre? 🦷💥`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Mordiéndose a sí mismo (Drama solitario)
        txt = `*¿Todo bien en casa?* @${selfTag} se mordió a sí mismo... ¡Eso debió doler! 🦷🤕`
      }

      // 5. Enviar el video/gif
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: targetJid ? '🦴' : '🚑', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}