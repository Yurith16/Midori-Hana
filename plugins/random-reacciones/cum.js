import axios from 'axios'
import '../../config.js'
import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['cum'],
  execute: async (sock, msg, { from }) => {
    // 1. Extraemos el prefijo y comando manualmente para evitar los 'undefined'
    const textMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const usedPrefix = textMsg.charAt(0)
    const usedCommand = textMsg.split(' ')[0].slice(1)

    // 2. Detectar objetivo (mencionado o citado)
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo
    const targetJid = contextInfo?.participant || contextInfo?.mentionedJid?.[0]

    // 3. Mensaje de ayuda limpio y con diseño de cita
    if (!targetJid) {
      const helpText = `text: "> *Etiqueta a quien quieres dejarle un regalito...* 💦🔥\n\n` +
                       `*Uso:* ${usedPrefix}${usedCommand} @user`
      
      return sock.sendMessage(from, { text: helpText }, { quoted: msg })
    }

    // 4. Reacción inicial
    await sock.sendMessage(from, { react: { text: '🤭', key: msg.key } })

    try {
      const apiUrl = `https://api.delirius.store/reactions/cum`
      const { data: res } = await axios.get(apiUrl)

      if (!res.status || !res.data) throw new Error()

      // 5. Obtener JIDs reales
      const selfJid = await getRealJid(sock, msg.key.participant || msg.key.remoteJid, msg)
      const victimJid = await getRealJid(sock, targetJid, msg)

      // 6. Mensaje final con drama
      const txt = `*¡Oh no!* @${selfJid.split('@')[0]} acabó en @${victimJid.split('@')[0]} 🤭🔥`

      const enviado = await sock.sendMessage(from, {
        video: { url: res.data.url },
        caption: txt,
        gifPlayback: true,
        mentions: [selfJid, victimJid]
      }, { quoted: msg })

      if (enviado) {
        await sock.sendMessage(from, { react: { text: '🔥', key: enviado.key } })
      }

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}