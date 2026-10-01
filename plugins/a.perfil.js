// plugins/perfil.js
import fs   from 'fs'
import axios from 'axios'
import sharp from 'sharp'
import { getUser, ensureRegistered } from '../core/sqlite.js'
import { getRealJid, cleanNumber } from '../utils/jid.js'
import { resolveTarget } from '../utils/target.js'
import { toMono } from '../utils/helpers.js'

const PERFIL_DEFAULT_IMG = './media/perfil.png'
const URL_PRUEBA = 'https://github.com/Yurith16/'
const BULLET = '•'
const VACIO  = '─'

function formatDate(timestamp) {
  if (!timestamp || timestamp === 0) return null
  const date = new Date(timestamp * 1000)
  const dia  = String(date.getDate()).padStart(2, '0')
  const mes  = String(date.getMonth() + 1).padStart(2, '0')
  const año  = date.getFullYear()
  return `${dia}/${mes}/${año}`
}

function esFotoValida(str) {
  if (!str) return false
  if (str.startsWith('http://') || str.startsWith('https://')) return 'url'
  if (fs.existsSync(str)) return 'local'
  return false
}

function estaVacio(val) {
  return val === undefined || val === null || val === '' || val === 0
}

function linea(perfil, key, label, esPropio, formatter = v => v) {
  const val = perfil[key]
  if (estaVacio(val)) {
    return esPropio ? `> ${BULLET} *${label}* · ${VACIO}\n` : ''
  }
  return `> ${BULLET} *${label}* · ${formatter(val)}\n`
}

export default {
  command:     ['perfil', 'profile', 'm'],
  tag:         'perfil',
  categoria:   'main',
  owner:       false,
  group:       false,
  nsfw:        false,
  descripcion: 'Muestra tu perfil o el de alguien más',

  async execute(sock, msg, { from, args, sender }) {
    const realJid = await getRealJid(sock, sender, msg).catch(() => sender)
    const ownNum  = cleanNumber(realJid)
    if (ownNum) ensureRegistered(ownNum, msg.pushName)

    const target = args.length ? await resolveTarget(sock, msg, args) : null
    const user    = target?.num || ownNum

    if (!user) {
      return sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }

    const perfil = getUser(user)
    if (!perfil) {
      return sock.sendMessage(from, {
        text: target?.num ? 'Ese usuario aún no tiene perfil.' : global.messages.error
      }, { quoted: msg })
    }

    const esPropio = !target?.num

    let txt = `> ╭─〔 🌸 *Esencia* 🌸 〕\n`

    txt += `> ${BULLET} *Nombre* · ${perfil.nombre}\n`
    txt += linea(perfil, 'edad',   'Edad',   esPropio, v => `${v} años`)
    txt += linea(perfil, 'frase',  'Frase',  esPropio, v => `_${v}_`)
    txt += linea(perfil, 'animal', 'Animal', esPropio)

    if (perfil.registered_at) {
      txt += `> ${BULLET} *Registrado* · ${formatDate(perfil.registered_at)}\n`
    }
    if (perfil.kryons > 0) {
      txt += `> ${BULLET} *Fortuna* · ${perfil.kryons} kryons\n`
    }

    txt += `> ╰─〔 🌸 *${toMono(global.bot?.name || 'Midori-Hana')}* 🌸 〕`

    const mentions  = target?.num ? [`${target.num}@s.whatsapp.net`] : []
    const fotoFinal = esFotoValida(perfil.foto) ? perfil.foto : PERFIL_DEFAULT_IMG
    const tipoFoto  = esFotoValida(fotoFinal)

    await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

    // Miniatura para el link preview (300x300 JPEG)
    let thumb = null
    if (tipoFoto) {
      try {
        if (tipoFoto === 'url') {
          const res = await axios.get(fotoFinal, { responseType: 'arraybuffer', timeout: 15000 })
          thumb = await sharp(Buffer.from(res.data))
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer()
        } else {
          thumb = await sharp(fotoFinal)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer()
        }
      } catch {
        thumb = null
      }
    }

    try {
      await sock.sendMessage(from, {
        text: `${URL_PRUEBA} mira esto\n\n${txt}`,
        linkPreview: {
          'matched-text': URL_PRUEBA,
          title: perfil.nombre || 'Midori-Hana',
          description: perfil.frase || 'Bot de WhatsApp',
          previewType: 0,
          ...(thumb ? { jpegThumbnail: thumb } : {})
        },
        mentions
      }, { quoted: msg })
    } catch {
      await sock.sendMessage(from, { text: txt, mentions }, { quoted: msg })
    }
  }
}