export default {
  command: ['tag', 'todos', 'everyone'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isOwner }) {
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> 🍃 *No tienes permisos para usar este comando*' }, { quoted: msg })
      return
    }

    try {
      const participants = metadata.participants.map(p => p.id)
      const total = participants.length
      const razon = args.length ? args.join(' ') : 'Atención general'

      const fecha = new Date().toLocaleString('es-HN', { 
        timeZone: 'America/Tegucigalpa',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      let texto = `╭─〔 🌸 *NOTIFICACIÓN GRUPAL* 🌸 〕\n`
      texto += `│\n`
      texto += `│ 📢 *Mensaje:* ${razon}\n`
      texto += `│ 👥 *Total miembros:* ${total}\n`
      texto += `│ 📅 *Fecha:* ${fecha}\n`
      texto += `│ 👑 *Autor:* @${sender.split('@')[0]}\n`
      texto += `│\n`
      texto += `╰─────────────────\n\n`
      texto += `> 🍃 *Por favor, presten atención al mensaje anterior*`

      await sock.sendMessage(from, {
        text: texto,
        mentions: participants
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '📢', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> 🍃 *Error al enviar la notificación*' }, { quoted: msg })
    }
  }
}