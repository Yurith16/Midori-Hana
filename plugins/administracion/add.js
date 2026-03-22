export default {
  command: ['add', 'agregar'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Obtener número a agregar
    let target = args[0]
    if (!target) {
      await sock.sendMessage(from, { 
        text: '❌ Escribe el número del usuario a agregar\n\nEjemplo: .add 50496926150' 
      }, { quoted: msg })
      return
    }

    // Limpiar número
    const cleanNumber = target.replace(/[^0-9]/g, '')
    const userJid = cleanNumber + '@s.whatsapp.net'

    // No agregar al bot mismo
    if (userJid === sock.user.id) {
      await sock.sendMessage(from, { 
        text: '🤖 Ya estoy en el grupo' 
      }, { quoted: msg })
      return
    }

    try {
      await sock.groupParticipantsUpdate(from, [userJid], 'add')
      await sock.sendMessage(from, { 
        text: `✅ Usuario ${cleanNumber} agregado correctamente` 
      }, { quoted: msg })
    } catch (error) {
      let errorMsg = '❌ No se pudo agregar al usuario'
      if (error.message?.includes('405')) {
        errorMsg = '❌ El usuario tiene desactivado que lo agreguen a grupos'
      } else if (error.message?.includes('403')) {
        errorMsg = '❌ El bot no tiene permisos para agregar'
      }
      await sock.sendMessage(from, { 
        text: errorMsg 
      }, { quoted: msg })
    }
  }
}