export default {
  command: ['kick', 'hakai'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, isOwner }) {
    // Verificar si el sender es admin
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants
      .filter(p => p.admin)
      .map(p => p.id)

    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender)) {
      await sock.sendMessage(from, {
        text: '⛔ Solo admins pueden expulsar miembros'
      }, { quoted: msg })
      return
    }

    // Obtener el usuario objetivo: por @tag o por mensaje citado
    let targetUser = null

    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
    const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant

    if (mentioned && mentioned.length > 0) {
      // Caso 1: .kick @usuario
      targetUser = mentioned[0]
    } else if (quotedParticipant) {
      // Caso 2: respondiendo al mensaje del usuario
      targetUser = quotedParticipant
    }

    if (!targetUser) {
      await sock.sendMessage(from, {
        text: '⚠️ Responde o etiqueta a la persona para expulsar'
      }, { quoted: msg })
      return
    }

    // Evitar que se expulsen a sí mismos
    if (targetUser === sender) {
      await sock.sendMessage(from, {
        text: '⚠️ No puedes expulsarte a ti mismo'
      }, { quoted: msg })
      return
    }

    // Evitar expulsar a otro admin
    if (groupAdmins.includes(targetUser)) {
      await sock.sendMessage(from, {
        text: '⚠️ No puedes expulsar a un administrador'
      }, { quoted: msg })
      return
    }

    try {
      await sock.groupParticipantsUpdate(from, [targetUser], 'remove')

      await sock.sendMessage(from, {
        text: `✅ Usuario expulsado del grupo`
      }, { quoted: msg })

    } catch (error) {
      await sock.sendMessage(from, {
        text: '⚠️ No se pudo expulsar al usuario'
      }, { quoted: msg })
    }
  }
}