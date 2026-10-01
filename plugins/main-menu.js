// plugins/menu.js
import fs   from 'fs'
import axios from 'axios'
import sharp from 'sharp'
import { commands } from '../core/plugins.js'
import db           from '../core/sqlite.js'
import bot          from '../settings/bot.js'

const startTime = Date.now()
const URL_PRUEBA = 'https://github.com/Yurith16/'
const BULLET = '•'
const PUNTO_CMD = '▸'

const CATEGORY_NAME = {
  main:      'PRINCIPAL',
  admin:     'ADMINISTRACIÓN',
  descargas: 'DESCARGAS',
  utilidad:  'HERRAMIENTAS',
  owner:     'OWNER',
}

const ORDEN = ['main', 'admin', 'descargas', 'utilidad', 'owner']

function uptime() {
  const ms = Date.now() - startTime
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor(ms / 60000) % 60
  const s  = Math.floor(ms / 1000) % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function getDate() {
  return new Date().toLocaleDateString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

function getTime() {
  return new Date().toLocaleTimeString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

let cachedMenuImg = null
async function getMenuImage() {
  if (cachedMenuImg) return cachedMenuImg
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(bot.defaultImg, { signal: controller.signal })
    clearTimeout(timer)
    cachedMenuImg = Buffer.from(await res.arrayBuffer())
  } catch {
    cachedMenuImg = null
  }
  return cachedMenuImg
}

export default {
  command:     'menu',
  tag:         'menu',
  categoria:   'main',
  descripcion: 'Muestra todo lo que puedo hacer',
  owner:       false,
  group:       false,
  nsfw:        false,

  async execute(sock, msg, { from, prefix }) {
    try {
      const ping = Date.now()
      await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })
      const latency = Date.now() - ping

      const botName = bot.name || 'Midori Hana'

      const seen    = new Set()
      const mapa    = {}
      const descMap = {}
      let   total   = 0

      for (const p of commands.values()) {
        if (!p.command || !p.categoria) continue
        const name = p.tag || (Array.isArray(p.command) ? p.command[0] : p.command)
        if (seen.has(name)) continue
        seen.add(name)
        const cat = p.categoria || 'main'
        if (!mapa[cat]) mapa[cat] = []
        mapa[cat].push(name)
        descMap[name] = p.descripcion || ''
        total++
      }

      let grupos = 0
      try {
        const g = await sock.groupFetchAllParticipating()
        grupos = Object.keys(g).length
      } catch {}

      let totalUsuarios = 0
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM users`).get()
        totalUsuarios = row?.count || 0
      } catch (e) {
        console.error('Error al obtener el conteo de usuarios:', e)
      }

      const fecha    = getDate()
      const hora     = getTime()
      const ownerNum = bot.ownerNumber?.[0] || ''
      const botNum   = bot.botNumber || ''
      const mentions = [ownerNum, botNum].filter(Boolean).map(n => `${n}@s.whatsapp.net`)

      // ─── Cabecera ───
      let menuTxt = `> _Identidad_\n`
      menuTxt += `> ${BULLET} *Dueño* · ${bot.owner || 'Hernandez'}\n`
      if (ownerNum) menuTxt += `> ${BULLET} *Contacto* · @${ownerNum}\n`
      if (botNum)   menuTxt += `> ${BULLET} *Bot* · @${botNum}\n`
      menuTxt += `> ${BULLET} *Versión* · ${bot.version || '1.0.0'}\n`
      menuTxt += `> ${BULLET} *Prefijo* · ${prefix}\n`
      if (bot.grupoOficial) menuTxt += `> ${BULLET} *Grupo* · ${bot.grupoOficial}\n`

      menuTxt += `\n> _Estado actual_\n`
      menuTxt += `> ${BULLET} *Fecha* · ${fecha}\n`
      menuTxt += `> ${BULLET} *Hora* · ${hora} · Honduras\n`
      menuTxt += `> ${BULLET} *Activo* · ${uptime()}\n`
      menuTxt += `> ${BULLET} *Grupos* · ${grupos}\n`
      menuTxt += `> ${BULLET} *Latencia* · ${latency}ms\n`
      menuTxt += `> ${BULLET} *Usuarios* · ${totalUsuarios}\n`
      menuTxt += `> ${BULLET} *Comandos* · ${total}\n`

      menuTxt += `\n_Hazme trabajar duro hoy, que para eso estoy aquí..._ 🤭\n`

      // ─── Categorías ───
      const EMOJIS_CAT = ['🐞', '🌴', '🐝']
      const emojiCat = EMOJIS_CAT[Math.floor(Math.random() * EMOJIS_CAT.length)]

      for (const cat of ORDEN) {
        const cmds = mapa[cat]
        if (!cmds?.length) continue
        const nombre = CATEGORY_NAME[cat] || cat.toUpperCase()

        menuTxt += `\n> 〔 ${emojiCat} *${nombre}* ${emojiCat} 〕\n`
        cmds.sort().forEach(cmd => {
          menuTxt += ` ${PUNTO_CMD} *${prefix}${cmd}*\n`
          const desc = descMap[cmd]
          if (desc) menuTxt += `> ↳ _${desc}_\n`
        })
      }

      menuTxt += `\n🌸 ¿Te vas a quedar un rato más conmigo o solo viniste por mis funciones?`

      const imgBuffer = await getMenuImage()
      let thumb = null
      if (imgBuffer) {
        try {
          thumb = await sharp(imgBuffer)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 80 })
            .toBuffer()
        } catch {
          thumb = null
        }
      }

      const displayName = (botName || 'Midori Hana')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())

      try {
        await sock.sendMessage(from, {
          text: `${URL_PRUEBA}\n\n${menuTxt}`,
          linkPreview: {
            'matched-text': URL_PRUEBA,
            title: `🌸 ${displayName} 🌸`,
            description: 'Menú de comandos',
            previewType: 0,
            ...(thumb ? { jpegThumbnail: thumb } : {})
          },
          mentions
        }, { quoted: msg })
      } catch {
        await sock.sendMessage(from, { text: menuTxt, mentions }, { quoted: msg })
      }

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: global.messages?.error }, { quoted: msg })
    }
  }
}