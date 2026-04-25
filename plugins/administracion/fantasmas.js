import { getGroupConfig } from '../../database/db.js'
import { getSubbotGroupConfig } from '../../database/db-subbot.js'
import { getRealJid, cleanNumber } from '../../utils/jid.js'

const SEMANA = 7 * 24 * 60 * 60 * 1000

export default {
  command: ['fantasmas'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner, subbotNumero }) {
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
      let activity = {}

      // Obtener actividad según si es subbot o bot principal
      if (subbotNumero) {
        const subbotGroupCfg = await getSubbotGroupConfig(subbotNumero, from)
        activity = subbotGroupCfg?.activity || {}
      } else {
        const cfg = getGroupConfig(from)
        activity = cfg.activity || {}
      }

      const ahora = Date.now()
      const botId = cleanNumber(sock.user.id)

      const miembros = metadata.participants.filter(p => !p.admin)

      const fantasmas = []
      const idsFantasmas = []

      for (const p of miembros) {
        // Obtener número limpio del participante
        let num
        try {
          const realJid = await getRealJid(sock, p.id, { key: { remoteJid: from } })
          num = cleanNumber(realJid)
        } catch {
          num = cleanNumber(p.id)
        }
        
        if (!num || num === botId) continue
        
        const ultimo = activity[num]?.last || 0
        const esFantasma = !ultimo || (ahora - ultimo) > SEMANA
        
        if (esFantasma) {
          fantasmas.push(p)
          idsFantasmas.push(p.id)
        }
      }

      if (!fantasmas.length) {
        await sock.sendMessage(from, { text: '> No hay fantasmas en este grupo 🍃\nTodos han hablado en los últimos 7 días' }, { quoted: msg })
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
        return
      }

      const lista = fantasmas.map(p => `@${p.id.split('@')[0]}`).join('\n')

      await sock.sendMessage(from, {
        text: `> 👻 *Fantasmas del grupo* (${fantasmas.length})\n> Sin actividad en los últimos 7 días 🍃\n\n${lista}`,
        mentions: idsFantasmas
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo obtener la lista de fantasmas 🍃' }, { quoted: msg })
    }
  }
}