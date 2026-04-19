import { cleanNumber } from '../../utils/jid.js'
import { getGroupConfig } from '../../database/db.js'

export default {
  command: ['mutelist', 'listmute', 'silenciados'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner }) {
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
    const sender = msg.key.participant || msg.key.remoteJid

    // Solo admins o el owner pueden ver la lista
    if (!groupAdmins.includes(sender) && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '*Solo los administradores pueden ver esta lista 🍃*' }, { quoted: msg })
      return
    }

    const groupCfg = getGroupConfig(from)
    const mutedList = groupCfg.mutedUsers || {}
    const entradas = Object.entries(mutedList).filter(([, v]) => v === true)

    if (!entradas.length) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, { text: '*No hay almas silenciadas en este grupo por ahora 🍃*' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🔇', key: msg.key } })

    const participantMap = {}
    for (const p of groupMetadata.participants) {
      participantMap[cleanNumber(p.id)] = p.id
    }

    let lista = `*Estos son los usuarios silenciados:* 🍃\n\n`
    const ids = []

    entradas.forEach(([num], index) => {
      const jid = participantMap[num]
      // Si el JID existe en el grupo lo usamos para la mención, si no, usamos el número limpio
      const tag = jid ? `@${jid.split('@')[0]}` : `+${num}`

      lista += `*${index + 1}- ${tag}*\n`
      lista += `Estado: Muteado (Sin voz)\n`
      lista += `──────────────────\n`

      if (jid) ids.push(jid)
    })

    lista += `\n_El silencio a veces es la mejor respuesta... 🍃_`

    await sock.sendMessage(from, {
      text: lista.trim(),
      mentions: ids
    }, { quoted: msg })
  }
}