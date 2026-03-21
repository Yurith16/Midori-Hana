export default {
  command: ['del', 'delete'],
  group: true,
  owner: true,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

    if (!quotedMsg) {
      await sock.sendMessage(from, { 
        text: '❌ Responde al mensaje que quieres eliminar\nEjemplo: .delete (respondiendo a un mensaje)' 
      }, { quoted: msg })
      return
    }

    try {
      const quotedKey = msg.message.extendedTextMessage.contextInfo

      await sock.sendMessage(from, {
        delete: {
          remoteJid: from,
          fromMe: false,
          id: quotedKey.stanzaId,
          participant: quotedKey.participant || from
        }
      })

      await sock.sendMessage(from, { 
        text: '✅ Mensaje eliminado' 
      }, { quoted: msg })

    } catch (error) {
      await sock.sendMessage(from, { 
        text: '❌ No se pudo eliminar' 
      }, { quoted: msg })
    }
  }
}