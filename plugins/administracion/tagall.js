import { getGroupConfig } from '../../database/db.js'

export default {
  command: ['contador'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
    const metadata = await sock.groupMetadata(from)
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                    metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })

    try {
      const cfg = getGroupConfig(from)
      const activity = cfg.activity || {}
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'

      const admins = metadata.participants.filter(p => p.admin && p.id !== botId)
      const miembros = metadata.participants.filter(p => !p.admin && p.id !== botId)

      // Ordenar miembros por cantidad de mensajes (mayor primero)
      miembros.sort((a, b) => (activity[b.id]?.count || 0) - (activity[a.id]?.count || 0))

      const todos = [...admins, ...miembros]
      const ids = todos.map(p => p.id)

      let lista = `> 🌿 *${metadata.subject}*\n> *${todos.length} miembros* 🍃\n\n`

      admins.forEach((p, i) => {
        const count = activity[p.id]?.count || 0
        lista += `${i + 1}. 🌱 @${p.id.split('@')[0]} — ${count} msgs\n`
      })

      miembros.forEach((p, i) => {
        const count = activity[p.id]?.count || 0
        lista += `${admins.length + i + 1}. @${p.id.split('@')[0]} — ${count} msgs\n`
      })

      await sock.sendMessage(from, {
        text: lista.trim(),
        mentions: ids
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo etiquetar a todos 🍃' }, { quoted: msg })
    }
  }
}