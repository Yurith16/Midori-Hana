import { getGroupConfig } from '../../database/db.js'

export default {
  command: [],
  before: async (sock, msg, { from, isGroup, sender, isOwner, isAdmin, config }) => {
    try {
      if (!isGroup || isOwner || isAdmin) return false
      
      const groupCfg = getGroupConfig(from)
      if (!groupCfg.antiLink) return false
      
      // Obtener texto de forma segura
      let text = ''
      if (msg.message?.conversation) text = msg.message.conversation
      else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text
      else if (msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption
      else if (msg.message?.videoMessage?.caption) text = msg.message.videoMessage.caption
      
      if (!text) return false
      
      const lowerText = text.toLowerCase()
      
      // Detectar enlaces prohibidos
      if (!lowerText.includes('chat.whatsapp.com') && 
          !lowerText.includes('t.me') && 
          !lowerText.includes('telegram.me')) return false
      
      const metadata = await sock.groupMetadata(from)
      const botId = sock.user.id
      const botParticipant = metadata.participants.find(p => p.id === botId)
      const isBotAdmin = botParticipant && (botParticipant.admin === 'admin' || botParticipant.admin === 'superadmin')
      
      if (isBotAdmin) {
        try {
          await sock.sendMessage(from, { delete: msg.key })
          await sock.groupParticipantsUpdate(from, [sender], 'remove')
          await sock.sendMessage(from, {
            text: `> 🔗 *ENLACE DETECTADO*\n\n> @${sender.split('@')[0]} ha sido eliminado.`,
            mentions: [sender]
          })
        } catch (err) {}
      } else {
        await sock.sendMessage(from, {
          text: `> 🔗 *ENLACE DETECTADO*\n\n> @${sender.split('@')[0]} los enlaces no están permitidos.`,
          mentions: [sender]
        }, { quoted: msg })
      }
      
      return true
      
    } catch (err) {
      console.error('Antilink error:', err.message)
      return false
    }
  }
}