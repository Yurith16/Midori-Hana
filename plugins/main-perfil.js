// plugins/perfil.js
import fs   from 'fs'
import axios from 'axios'
import { getUser, ensureRegistered } from '../core/sqlite.js'
import { getRealJid, cleanNumber } from '../utils/jid.js'
import { resolveTarget } from '../utils/target.js'
import { toMono } from '../utils/helpers.js'

const PERFIL_DEFAULT_IMG = './media/perfil.png'
const BULLETS = ['🐞', '📍', '🐝']
const VACIO   = '─'

const CAMPOS_OPCIONALES = ['apodo', 'edad', 'genero', 'titulo', 'cumple', 'frase', 'color', 'animal']

function formatDate(timestamp) {
  if (!timestamp || timestamp === 0) return null
  const date = new Date(timestamp * 1000)
  const dia  = String(date.getDate()).padStart(2, '0')
  const mes  = String(date.getMonth() + 1).padStart(2, '0')
  const año  = date.getFullYear()
  return `${dia}/${mes}/${año}`
}

function tiempoTranscurrido(timestamp) {
  if (!timestamp) return null
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60)    return 'justo ahora'
  const min = Math.floor(diff / 60)
  if (min < 60)     return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)       return `hace ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30)       return `hace ${d} día${d > 1 ? 's' : ''}`
  const mo = Math.floor(d / 30)
  if (mo < 12)      return `hace ${mo} mes${mo > 1 ? 'es' : ''}`
  const y = Math.floor(mo / 12)
  return `hace ${y} año${y > 1 ? 's' : ''}`
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

function linea(perfil, key, label, bullet, esPropio, formatter = v => v) {
  const val = perfil[key]
  if (estaVacio(val)) {
    return esPropio ? `> │ ${bullet} *${label}* · ${VACIO}\n` : ''
  }
  return `> │ ${bullet} *${label}* · ${formatter(val)}\n`
}

export default {
  command:     ['perfil', 'profile', 'me'],
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
    const bullet   = BULLETS[Math.floor(Math.random() * BULLETS.length)]

    let txt = `> ╭─〔 🌸 *Esencia* 🌸 〕\n`

    txt += `> │ ${bullet} *Nombre* · ${perfil.nombre}\n`
    txt += linea(perfil, 'apodo',  'Apodo',      bullet, esPropio)
    txt += linea(perfil, 'edad',   'Edad',       bullet, esPropio, v => `${v} años`)
    txt += linea(perfil, 'genero', 'Género',     bullet, esPropio)
    txt += linea(perfil, 'titulo', 'Título',     bullet, esPropio)
    txt += linea(perfil, 'cumple', 'Cumpleaños', bullet, esPropio)

    if (perfil.registered_at) {
      txt += `> │ ${bullet} *Registrado* · ${formatDate(perfil.registered_at)}\n`
    }
    if (perfil.ultima_actividad) {
      txt += `> │ ${bullet} *Última actividad* · ${tiempoTranscurrido(perfil.ultima_actividad)}\n`
    }

    txt += linea(perfil, 'frase',  'Frase',  bullet, esPropio, v => `_${v}_`)
    txt += linea(perfil, 'color',  'Color',  bullet, esPropio)
    txt += linea(perfil, 'animal', 'Animal', bullet, esPropio)

    if (esPropio) {
      const faltan = CAMPOS_OPCIONALES.filter(c => estaVacio(perfil[c])).length
      if (faltan > 0) {
        txt += `> │\n> │ _Me debes ${faltan} dato${faltan > 1 ? 's' : ''} todavía. No te apures, te espero._\n`
      }
    }

    txt += `> ╰─── ${toMono(global.bot?.name || 'Midori-Hana')}`

    const mentions  = target?.num ? [`${target.num}@s.whatsapp.net`] : []
    const fotoFinal = esFotoValida(perfil.foto) ? perfil.foto : PERFIL_DEFAULT_IMG
    const tipoFoto  = esFotoValida(fotoFinal)

    await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })

    if (tipoFoto) {
      try {
        const imgBuffer = tipoFoto === 'url'
          ? Buffer.from((await axios.get(fotoFinal, { responseType: 'arraybuffer', timeout: 15000 })).data)
          : fs.readFileSync(fotoFinal)

        const esVideo = fotoFinal.endsWith('.mp4')
        const esGif   = fotoFinal.endsWith('.gif') || fotoFinal.endsWith('.webp')

        if (esVideo) {
          await sock.sendMessage(from, { video: imgBuffer, caption: txt, mentions }, { quoted: msg })
        } else if (esGif) {
          await sock.sendMessage(from, { video: imgBuffer, gifPlayback: true, caption: txt, mentions }, { quoted: msg })
        } else {
          await sock.sendMessage(from, { image: imgBuffer, caption: txt, mentions }, { quoted: msg })
        }
      } catch {
        await sock.sendMessage(from, { text: txt, mentions }, { quoted: msg })
      }
    } else {
      await sock.sendMessage(from, { text: txt, mentions }, { quoted: msg })
    }
  }
}