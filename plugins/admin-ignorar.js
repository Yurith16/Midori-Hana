import { ignoreUser, isIgnored } from '../core/sqlite.js'
import { resolveTarget }         from '../utils/target.js'

export default {
  command:     ['ignorar', 'ignore'],
  tag:         'ignorar',
  categoria:   'admin',
  owner:       false,
  group:       true,
  descripcion: 'Ignoraré a un usuario en este grupo',

  async execute(sock, msg, { from, args, isAdmin, isOwner }) {
    await sock.sendMessage(from, { react: { text: global.getRandomReaction('admin'), key: msg.key } })

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { text: global.messages?.notAdmin }, { quoted: msg })
      return
    }

    const target = await resolveTarget(sock, msg, args)
    if (!target?.num) {
      await sock.sendMessage(from, { text: global.messages?.userNeeded }, { quoted: msg })
      return
    }

    if (target.isAdmin || target.isOwner) {
      await sock.sendMessage(from, { text: 'No puedo ignorar a un administrador o al creador del bot.' }, { quoted: msg })
      return
    }

    if (isIgnored(from, target.num)) {
      await sock.sendMessage(from, { text: 'Ese usuario ya estaba ignorado en este grupo.' }, { quoted: msg })
      return
    }

    ignoreUser(from, target.num)

    await sock.sendMessage(from, {
      text: `Listo, a partir de ahora ignoraré los comandos de @${target.num} en este grupo.`,
      mentions: [`${target.num}@s.whatsapp.net`]
    }, { quoted: msg })
  }
}