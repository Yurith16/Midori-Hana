export default {
  command: ['anuncio', 'broadcast'],
  group: false,
  owner: true,

  async execute(sock, msg, { args, from, isOwner }) {
    if (!isOwner) {
      await sock.sendMessage(from, { text: 'Este comando es exclusivo del owner 🔒' }, { quoted: msg })
      return
    }

    if (!args.length) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: 'Escribe el mensaje que deseas anunciar.\nEjemplo: .anuncio El bot fue actualizado 🍃' }, { quoted: msg })
      return
    }

    const texto = args.join(' ')
    const mensaje = `📢 *Anuncio oficial*\n\n${texto}\n\n— ${global.config?.botName || 'Midori-Hana'} 🍃`

    await sock.sendMessage(from, { react: { text: '📢', key: msg.key } })
    await sock.sendMessage(from, { text: 'Enviando anuncio... esto puede tomar varios minutos 🍃' }, { quoted: msg })

    let grupos    = 0
    let privados  = 0
    let fallidos  = 0

    try {
      // Obtener todos los chats
      const chats = await sock.groupFetchAllParticipating()
      const groupIds = Object.keys(chats)

      // Enviar a grupos con pausa de 2 minutos entre cada uno
      for (const groupId of groupIds) {
        try {
          await sock.sendMessage(groupId, { text: mensaje })
          grupos++
        } catch {
          fallidos++
        }
        // Pausa de 2 minutos entre envíos para evitar ban
        await new Promise(r => setTimeout(r, 2 * 60 * 1000))
      }

      // Enviar a chats privados conocidos
      const store = sock.store || null
      if (store?.chats) {
        const privatChats = [...store.chats.values()].filter(c =>
          c.id.endsWith('@s.whatsapp.net') && !c.id.includes(sock.user?.id?.split(':')[0])
        )

        for (const chat of privatChats) {
          try {
            await sock.sendMessage(chat.id, { text: mensaje })
            privados++
          } catch {
            fallidos++
          }
          await new Promise(r => setTimeout(r, 2 * 60 * 1000))
        }
      }

    } catch (err) {
      console.error('Error en anuncio:', err)
    }

    // Reporte final al owner
    await sock.sendMessage(from, {
      text: `✅ *Anuncio completado*\n\n📦 Grupos notificados: ${grupos}\n💬 Chats privados: ${privados}\n⚠️ Fallidos: ${fallidos}\n\nTotal: ${grupos + privados} destinatarios 🍃`
    }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}