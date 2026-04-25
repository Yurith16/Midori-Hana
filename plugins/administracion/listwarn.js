import { cleanNumber } from '../../utils/jid.js'
import { getAllWarns } from '../../database/db.js'
import { getSubbotGroupConfig } from '../../database/db-subbot.js'

const MAX_WARNS = 3

export default {
  command: ['listwarn', 'warns', 'advertencias'],
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

    await sock.sendMessage(from, { react: { text: '📋', key: msg.key } })

    const isSubbot = !!subbotNumero
    let allWarns = {}

    // Obtener warns según corresponda
    if (isSubbot) {
      const cfg = await getSubbotGroupConfig(subbotNumero, from)
      allWarns = cfg.warns || {}
    } else {
      allWarns = getAllWarns(from)
    }

    const entradas = Object.entries(allWarns).filter(([, v]) => v.count > 0)

    if (!entradas.length) {
      await sock.sendMessage(from, { react: { text: '🌿', key: msg.key } })
      await sock.sendMessage(from, { text: '*No hay almas advertidas en este grupo por ahora 🍃*' }, { quoted: msg })
      return
    }

    const participantMap = {}
    for (const p of groupMetadata.participants) {
      participantMap[cleanNumber(p.id)] = p.id
    }

    let lista = `*Estos son los usuarios con advertencias:* 🍃\n\n`
    const ids = []

    entradas.forEach(([num, entry], index) => {
      const jid = participantMap[num]
      const tag = jid ? `@${jid.split('@')[0]}` : `+${num}`

      lista += `*${index + 1}- ${tag}*\n`
      lista += `Cant adv: ${entry.count}/${MAX_WARNS}\n`
      lista += `──────────────────\n`

      if (jid) ids.push(jid)
    })

    lista += `\n_Recuerden que la paz del grupo es lo más importante... 🍃_`

    await sock.sendMessage(from, {
      text: lista.trim(),
      mentions: ids
    }, { quoted: msg })
  }
}