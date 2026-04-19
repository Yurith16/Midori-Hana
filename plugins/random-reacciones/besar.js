import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['besar', 'kiss'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos prefijo y comando manualmente
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'besar'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Reacción inicial de ternura
    await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/kiss`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 4. Obtener JIDs reales (Traducción de LID)
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const selfTag = selfJid.split('@')[0]

      let txt = ''
      let mentions = [selfJid]

      if (targetJid) {
        // ESCENARIO A: Beso dedicado (Amor correspondido o drama)
        const victimJid = await getRealJid(sock, targetJid, msg)
        const victimTag = victimJid.split('@')[0]

        // Un poco de drama romántico según el contexto
        txt = `*¡El amor está en el aire!* @${selfTag} le dio un beso inolvidable a @${victimTag}... 💋❤️`
        mentions.push(victimJid)
      } else {
        // ESCENARIO B: Besos al aire (Para todos)
        txt = `*¡Qué coqueto(a)!* @${selfTag} está lanzando besos a todo el mundo... ¡Cuidado, que enamora! 💋✨🌹`
      }

      // 5. Enviar el video/gif con el mensaje amigable
      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: mentions
      }, { quoted: msg })

      if (enviado) {
        // Reacción final: Corazón si es dedicado, destellos si es general
        await sock.sendMessage(from, { react: { text: targetJid ? '❤️' : '💖', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}