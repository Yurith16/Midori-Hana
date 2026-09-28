// plugins/perfil.js
import fs   from 'fs'
import axios from 'axios'
import { getUser, ensureRegistered } from '../core/sqlite.js'
import { getRealJid, cleanNumber } from '../utils/jid.js'
import { resolveTarget } from '../utils/target.js'
import { toMono } from '../utils/helpers.js'

const PERFIL_DEFAULT_IMG = 'https://www.image2url.com/r2/default/images/1780714746057-12c23aaf-4846-4012-b243-4d4f3bb09b4e.png'
const BULLETS = ['🐞', '📍', '🐝']

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

    const bullet = BULLETS[Math.floor(Math.random() * BULLETS.length)]

    let txt = `> ╭─〔 🌸 *Esencia* 🌸 〕\n`

    txt += `> │ ${bullet} *Nombre* · ${perfil.nombre}\n`
    if (perfil.apodo)  txt += `> │ ${bullet} *Apodo* · ${perfil.apodo}\n`
    if (perfil.edad)   txt += `> │ ${bullet} *Edad* · ${perfil.edad} años\n`
    if (perfil.genero) txt += `> │ ${bullet} *Género* · ${perfil.genero}\n`
    if (perfil.pais)   txt += `> │ ${bullet} *País* · ${perfil.pais}\n`
    if (perfil.registered_at) txt += `> │ ${bullet} *Registrado* · ${formatDate(perfil.registered_at)}\n`

    if (perfil.frase || perfil.color || perfil.animal) {
      if (perfil.frase)  txt += `> │ ${bullet} *Frase* · _${perfil.frase}_\n`
      if (perfil.color)  txt += `> │ ${bullet} *Color* · ${perfil.color}\n`
      if (perfil.animal) txt += `> │ ${bullet} *Animal* · ${perfil.animal}\n`
    } else {
      txt += `> │ ${bullet} *Frase* · _Usuario de Midori-Hana_\n`
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