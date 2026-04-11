export default {
  command: ['close', 'cerrar'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Obtener metadata del grupo para verificar admins
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants
      .filter(p => p.admin)
      .map(p => p.id)

    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender)) {
      await sock.sendMessage(from, {
        text: '❌ Solo los administradores pueden cerrar el grupo'
      }, { quoted: msg })
      return
    }

    try {
      await sock.groupSettingUpdate(from, 'announcement')

      await sock.sendMessage(from, {
        text: '🔒 Grupo cerrado\nSolo los administradores pueden enviar mensajes'
      }, { quoted: msg })

    } catch (error) {
      await sock.sendMessage(from, {
        text: '❌ No se pudo cerrar el grupo'
      }, { quoted: msg })
    }
  }
}