import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['besar','kiss'],
  reaction: true,
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos prefijo y comando manualmente para evitar 'undefined'
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedPrefix = textMsg.charAt(0) || '.'
    const usedCommand = textMsg.split(' ')[0].slice(1) || 'besar'

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Mensaje de ayuda variado para el amor
    if (!targetJid) {
      const helpText = `> *Etiqueta a la persona que te roba los suspiros...* 💋✨\n\n` +
                       `*Uso:* ${usedPrefix}${usedCommand} @user`
      
      return sock.sendMessage(from, { text: helpText }, { quoted: msg })
    }

    // 4. Reacción inicial de ternura
    await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/kiss`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 5. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const victimJid = await getRealJid(sock, targetJid, msg)

      // 6. Mensaje con el drama: Un beso que detiene el tiempo
      const txt = `*¡Qué tierno!* @${selfJid.split('@')[0]} le dio un beso inolvidable a @${victimJid.split('@')[0]}... 💋❤️`

      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: [selfJid, victimJid]
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '❤️', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}