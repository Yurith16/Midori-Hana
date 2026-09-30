// plugins/setperfil.js
import { setUserField, ensureRegistered } from '../core/sqlite.js'
import { getRealJid, cleanNumber }        from '../utils/jid.js'

const GENEROS = ['hombre', 'mujer', 'prefiero no decir']
const GENERO_DISPLAY = { hombre: 'Hombre', mujer: 'Mujer', 'prefiero no decir': 'Prefiero no decir' }

const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function validarCumple(valor) {
  const m = valor.match(/^(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const dia = parseInt(m[1], 10)
  const mes = parseInt(m[2], 10)
  if (mes < 1 || mes > 12) return null
  if (dia < 1 || dia > DIAS_MES[mes - 1]) return null
  return `${String(dia).padStart(2, '0')}-${String(mes).padStart(2, '0')}`
}

const CAMPOS = ['nombre', 'apodo', 'edad', 'genero', 'titulo', 'cumple', 'frase', 'color', 'animal']

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
        text: '¿Quieres que te conozca mejor? Puedo guardar tu nombre, apodo, edad, género, un título tuyo, tu cumpleaños, una frase, tu color y tu animal favorito — lo que tú quieras, cuando quieras.\n\nSi algún día quieres contarme alguna, así de fácil: .setperfil y el dato, por ejemplo .setperfil frase la vida es corta. Yo lo voy guardando, no hay ningún orden que seguir.'
      }, { quoted: msg })
    }

    const campo = args[0].toLowerCase()
    const valor = args.slice(1).join(' ').trim()

    if (!CAMPOS.includes(campo)) {
      return sock.sendMessage(from, {
        text: '¿Eso qué es? No tengo ningún dato que se llame así. Prueba con nombre, apodo, edad, genero, titulo, cumple, frase, color o animal.'
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

    if (campo === 'genero') {
      const norm = valor.toLowerCase()
      if (!GENEROS.includes(norm)) {
        return sock.sendMessage(from, {
          text: 'Esa opción no existe. Elige entre hombre, mujer o prefiero no decir.'
        }, { quoted: msg })
      }
      final = GENERO_DISPLAY[norm]
    }

    if (campo === 'cumple') {
      const fecha = validarCumple(valor)
      if (!fecha) {
        return sock.sendMessage(from, {
          text: 'Esa fecha no me cuadra. Dámela como día-mes, por ejemplo 14-02.'
        }, { quoted: msg })
      }
      final = fecha
    }

    if (campo === 'nombre') {
      if (valor.length < 2 || valor.length > 30) {
        return sock.sendMessage(from, {
          text: 'Ese nombre no me sirve, dame algo entre 2 y 30 caracteres.'
        }, { quoted: msg })
      }
    }

    if (campo === 'apodo') {
      if (valor.length > 25) {
        return sock.sendMessage(from, {
          text: 'Ese apodo es casi un poema. Máximo 25 caracteres.'
        }, { quoted: msg })
      }
    }

    setUserField(userNum, campo, final)

    const confirmaciones = {
      nombre: `Listo, ahora te llamas *${final}*.`,
      apodo:  `Apodo actualizado: *${final}*.`,
      edad:   `Edad guardada: *${final} años*.`,
      genero: `Género: *${final}*.`,
      titulo: `Tu nuevo título: *${final}*.`,
      cumple: `Anotado, cumples el *${final}*.`,
      frase:  `Tu frase quedó así: _${final}_`,
      color:  `Color favorito: *${final}*.`,
      animal: `Animal favorito: *${final}*.`,
    }

    await sock.sendMessage(from, { text: confirmaciones[campo] }, { quoted: msg })
  }
}