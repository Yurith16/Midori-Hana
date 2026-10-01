// plugins/setperfil.js
import { setUserField, ensureRegistered } from '../core/sqlite.js'
import { getRealJid, cleanNumber }        from '../utils/jid.js'

const CAMPOS = ['nombre', 'edad', 'frase', 'animal']

export default {
  command:     ['setperfil', 'editarperfil'],
  tag:         'setperfil',
  categoria:   'main',
  owner:       false,
  group:       false,
  nsfw:        false,
  descripcion: 'Personaliza tu perfil',

  async execute(sock, msg, { from, args, sender, isGroup }) {
    if (isGroup) {
      return sock.sendMessage(from, {
        text: 'Eso mejor lo hacemos en privado, no todo el grupo necesita saber tu información. Escríbeme por aquí y lo resolvemos.'
      }, { quoted: msg })
    }

    const realJid = await getRealJid(sock, sender, msg).catch(() => sender)
    const userNum = cleanNumber(realJid)
    if (userNum) ensureRegistered(userNum, msg.pushName)

    if (!args.length) {
      return sock.sendMessage(from, {
        text: '¿Quieres que te conozca mejor? Puedo guardar tu nombre, edad, una frase y tu animal favorito — lo que tú quieras, cuando quieras.\n\nSi algún día quieres contarme alguna, así de fácil: .setperfil y el dato, por ejemplo .setperfil frase la vida es corta. Yo lo voy guardando, no hay ningún orden que seguir.'
      }, { quoted: msg })
    }

    const campo = args[0].toLowerCase()
    const valor = args.slice(1).join(' ').trim()

    if (!CAMPOS.includes(campo)) {
      return sock.sendMessage(from, {
        text: '¿Eso qué es? No tengo ningún dato que se llame así. Prueba con nombre, edad, frase o animal.'
      }, { quoted: msg })
    }

    if (!valor) {
      return sock.sendMessage(from, {
        text: '¿Y qué le pongo? Te faltó decirme el valor.'
      }, { quoted: msg })
    }

    let final = valor

    if (campo === 'edad') {
      const edad = parseInt(valor, 10)
      if (isNaN(edad) || edad < 13 || edad > 60) {
        return sock.sendMessage(from, {
          text: 'Esa no es una edad real, o no te voy a creer. Dame un número entre 13 y 60.'
        }, { quoted: msg })
      }
      final = edad
    }

    if (campo === 'nombre') {
      if (valor.length < 2 || valor.length > 30) {
        return sock.sendMessage(from, {
          text: 'Ese nombre no me sirve, dame algo entre 2 y 30 caracteres.'
        }, { quoted: msg })
      }
    }

    setUserField(userNum, campo, final)

    const confirmaciones = {
      nombre: `Listo, ahora te llamas *${final}*.`,
      edad:   `Edad guardada: *${final} años*.`,
      frase:  `Tu frase quedó así: _${final}_`,
      animal: `Animal favorito: *${final}*.`,
    }

    await sock.sendMessage(from, { text: confirmaciones[campo] }, { quoted: msg })
  }
}