import { getGroupConfig } from '../../database/db.js'

const SEMANA = 7 * 24 * 60 * 60 * 1000

export default {
  command: ['fantasmas'],
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

    await sock.sendMessage(from, { react: { text: '👻', key: msg.key } })

    try {
      const cfg = getGroupConfig(from)
      const activity = cfg.activity || {}
      const ahora = Date.now()
      const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net'

      const miembros = metadata.participants.filter(p => !p.admin && p.id !== botId)

      const fantasmas = miembros.filter(p => {
        const ultimo = activity[p.id]?.last
        return !ultimo || (ahora - ultimo) > SEMANA
      })

      if (!fantasmas.length) {
        await sock.sendMessage(from, { text: '> No hay fantasmas en este grupo 🍃\nTodos han hablado en los últimos 7 días' }, { quoted: msg })
        return
      }

      const ids = fantasmas.map(p => p.id)
      const lista = fantasmas.map(p => `@${p.id.split('@')[0]}`).join('\n')

      await sock.sendMessage(from, {
        text: `> 👻 *Fantasmas del grupo* (${fantasmas.length})\n> Sin actividad en los últimos 7 días 🍃\n\n${lista}`,
        mentions: ids
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo obtener la lista de fantasmas 🍃' }, { quoted: msg })
    }
  }
}