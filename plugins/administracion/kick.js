import { getRealJid } from '../../utils/jid.js'

export default {
  command: ['kick', 'expulsar', 'elimina', 'ban', 'echar', 'sacar'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Obtener usuarios mencionados o respondidos
    let users = []
    
    if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
      users = msg.message.extendedTextMessage.contextInfo.mentionedJid
    }
    
    if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
      users.push(msg.message.extendedTextMessage.contextInfo.participant)
    }
    
    if (users.length === 0 && args[0]) {
      const cleanNumber = args[0].replace(/[^0-9]/g, '')
      users.push(cleanNumber + '@s.whatsapp.net')
    }

    if (users.length === 0) {
      await sock.sendMessage(from, { 
        text: '❌ Menciona, responde o escribe el número del usuario a expulsar\n\nEjemplo: .kick @usuario' 
      }, { quoted: msg })
      return
    }

    // Filtrar para no expulsar al bot
    users = users.filter(u => u !== sock.user.id)
    
    if (users.length === 0) {
      await sock.sendMessage(from, { 
        text: '🤖 No puedo expulsarme a mí mismo' 
      }, { quoted: msg })
      return
    }

    try {
      for (let user of users) {
        await sock.groupParticipantsUpdate(from, [user], 'remove')
      }
      await sock.sendMessage(from, { 
        text: `✅ Usuario${users.length > 1 ? 's' : ''} expulsado${users.length > 1 ? 's' : ''} correctamente` 
      }, { quoted: msg })
    } catch (error) {
      await sock.sendMessage(from, { 
        text: `❌ Error: ${error.message}` 
      }, { quoted: msg })
    }
  }
}