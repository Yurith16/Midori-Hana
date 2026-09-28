// plugins/setprefix.js
import { setGroupField, getGroup } from '../core/sqlite.js'

export default {
  command:     ['prefix', 'prefijo'],
  tag:         'prefix',
  categoria:   'admin',
  owner:       false,
  group:       true,
  nsfw:        false,
  descripcion: 'Cambia la forma en que llamas a Midori',

  async execute(sock, msg, { from, args, isOwner, isAdmin }) {
    if (!isOwner && !isAdmin) {
      return sock.sendMessage(from, { text: global.messages.notAdmin }, { quoted: msg })
    }

    const cfg    = getGroup(from)
    const actual = cfg.prefix || global.bot?.prefix?.[0] || '!'

    if (!args.length) {
      return sock.sendMessage(from, {
        text: `🌸 ¿Buscabas esto? *${actual}* es como me hablas ahora. Lo cambias cuando quieras, no me voy a poner celosa.`
      }, { quoted: msg })
    }

    const nuevo = args[0].toLowerCase()

    if (nuevo === 'reset') {
      setGroupField(from, 'prefix', '')
      const globalPref = global.bot?.prefix?.[0] || '!'

      return sock.sendMessage(from, {
        text: `¿Ya te cansaste de tu prefijo? Qué bueno, porque ya volví a *${globalPref}*.`
      }, { quoted: msg })
    }

    if (nuevo.length > 3) {
      return sock.sendMessage(from, {
        text: `¿En serio necesitas tantas letras para llamarme? Yo con tres tengo de sobra.`
      }, { quoted: msg })
    }

    setGroupField(from, 'prefix', nuevo)

    await sock.sendMessage(from, {
      text: `¿Ves qué fácil? Ahora soy *${nuevo}*, no lo olvides tú porque yo no pienso repetirlo.`
    }, { quoted: msg })
  }
}