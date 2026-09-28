import { toBold, toMono } from '../utils/helpers.js'
import { commands }       from '../core/plugins.js'
import db                 from '../core/sqlite.js'
import bot                from '../settings/bot.js'

const startTime = Date.now()

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

// ─── Emoji fijo por categoría — nunca al azar, siempre reconocible ───────────

const CATEGORY_EMOJI = {
  main:      '🌱',
  admin:     '🌿',
  descargas: '🍃',
  utilidad:  '🌼',
  owner:     '🌷',
}

// ─── Imagen del menú cacheada — solo se descarga una vez por proceso ────────

let cachedMenuImg = null

async function getMenuImage() {
  if (cachedMenuImg) return cachedMenuImg
  try {
    const controller = new AbortController()
    const timer       = setTimeout(() => controller.abort(), 15000)
    const res          = await fetch(bot.defaultImg, { signal: controller.signal })
    clearTimeout(timer)
    cachedMenuImg = Buffer.from(await res.arrayBuffer())
  } catch {
    cachedMenuImg = null
  }
  return cachedMenuImg
}

function buildCategoryBox(catName, catKey, cmds, descMap, prefix) {
  const emoji = CATEGORY_EMOJI[catKey] || '📍'

  let txt = `〔 ${emoji} *${toMono(catName.toUpperCase())}* 〕\n\n`
  cmds.sort().forEach(cmd => {
    txt += `${emoji} *${prefix}${cmd}*\n`
    const desc = descMap[cmd]
    if (desc) txt += `> ↳ _${desc}_\n`
  })
  return txt
}

export default {
  command: 'menu',
  tag: 'menu',
  categoria: 'main',
  descripcion: 'Muestra todo lo que puedo hacer',
  owner: false,
  group: false,
  nsfw: false,

  async execute(sock, msg, { from, prefix }) {
    try {
      const ping = Date.now()
      await sock.sendMessage(from, { react: { text: '🌸', key: msg.key } })
      const latency = Date.now() - ping

      const botName = bot.name || 'Midori-Hana'

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

      let menuTxt = `╭─〔 🌸 *${toMono(botName.toUpperCase())}* 🌸 〕─╮\n\n`

      menuTxt += `> _Identidad_\n`
      menuTxt += `> ✦ *Dueño:* ${bot.owner || 'Hernandez'}\n`
      if (ownerNum) menuTxt += `> ✦ *Contacto:* @${ownerNum}\n`
      if (botNum)   menuTxt += `> ✦ *Bot Principal:* @${botNum}\n`
      menuTxt += `> ✦ *Versión:* ${bot.version || '1.0.0'}\n`
      menuTxt += `> ✦ *Prefijo:* ${prefix}\n`
      if (bot.grupoOficial) menuTxt += `> ✦ *Grupo Oficial:* ${bot.grupoOficial}\n`

      menuTxt += `\n> _Estado actual_\n`
      menuTxt += `> ✦ *Fecha:* ${fecha}\n`
      menuTxt += `> ✦ *Hora:* ${hora} · Honduras\n`
      menuTxt += `> ✦ *Activo:* ${uptime()}\n`
      menuTxt += `> ✦ *Grupos:* ${grupos}\n`
      menuTxt += `> ✦ *Latencia:* ${latency}ms\n`
      menuTxt += `> ✦ *Usuarios:* ${totalUsuarios}\n`
      menuTxt += `> ✦ *Comandos:* ${total}\n`

      menuTxt += `\n_Hazme trabajar duro hoy, que para eso estoy aquí..._ 🤭\n\n`

      const orden = ['main', 'admin', 'descargas', 'utilidad', 'owner']
      const categoryMap = {
        main:      'PRINCIPAL',
        admin:     'ADMINISTRACIÓN',
        descargas: 'DESCARGAS',
        utilidad:  'HERRAMIENTAS',
        owner:     'OWNER'
      }

      for (const cat of orden) {
        const cmds = mapa[cat]
        if (!cmds?.length) continue
        const nombre = categoryMap[cat] || cat.toUpperCase()
        menuTxt += buildCategoryBox(nombre, cat, cmds, descMap, prefix)
        menuTxt += '\n'
      }

      menuTxt += `🌸 ¿Te vas a quedar un rato más conmigo o solo viniste por mis funciones? No me dejes en visto...`

      const imgBuffer = await getMenuImage()

      try {
        if (imgBuffer) {
          await sock.sendMessage(from, {
            image: imgBuffer,
            caption: menuTxt,
            mentions
          }, { quoted: msg })
        } else {
          await sock.sendMessage(from, { text: menuTxt, mentions }, { quoted: msg })
        }
      } catch {
        await sock.sendMessage(from, { text: menuTxt, mentions }, { quoted: msg })
      }

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: global.messages?.error }, { quoted: msg })
    }
  }
}