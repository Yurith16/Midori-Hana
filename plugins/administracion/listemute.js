import { cleanNumber } from '../../utils/jid.js'
import { getGroupConfig } from '../../database/db.js'
import { getSubbotGroupConfig } from '../../database/db-subbot.js'

export default {
  command: ['mutelist', 'listmute', 'silenciados'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner, subbotNumero }) {
    const groupMetadata = await sock.groupMetadata(from)
    const groupAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id)
    const sender = msg.key.participant || msg.key.remoteJid

    if (!groupAdmins.includes(sender) && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '*Solo los administradores pueden ver esta lista 🍃*' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🔇', key: msg.key } })

    const isSubbot = !!subbotNumero
    let mutedList = {}

    // Obtener lista de muteados según corresponda
    if (isSubbot) {
      const cfg = await getSubbotGroupConfig(subbotNumero, from)
      mutedList = cfg.mutedUsers || {}
    } else {
      const cfg = getGroupConfig(from)
      mutedList = cfg.mutedUsers || {}
    }

    const entradas = Object.entries(mutedList).filter(([, v]) => v === true)

    if (!entradas.length) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, { text: '*No hay almas silenciadas en este grupo por ahora 🍃*' }, { quoted: msg })
      return
    }

    const participantMap = {}
    for (const p of groupMetadata.participants) {
      participantMap[cleanNumber(p.id)] = p.id
    }

    let lista = `*Estos son los usuarios silenciados:* 🍃\n\n`
    const ids = []

    entradas.forEach(([num], index) => {
      const jid = participantMap[num]
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