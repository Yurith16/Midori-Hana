import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.join(__dirname, '../..', 'plugins')

const MENU_IMAGES = [
  'https://www.image2url.com/r2/default/images/1776639876334-87e327fb-c225-42d5-bf68-a594f976fb49.jpg'
]

const EMOJI_SEQUENCES = {
  REACCIÓN:  ['🌿', '🍃', '🍀', '🌱', '🌼', '🌸', '🌺', '💮', '🥀', '🌻', '🌹', '🌷', '🏵️'],
  BULLET:    ['🍃', '🌱', '🍀', '🌿', '🌼', '🌸', '🌺', '🌻', '🌹', '🌷', '☘️', '🥀', '💐'],
  BOT_TITLE: ['🔥', '🌟', '✨', '⭐', '💫', '⚡', '💥', '🌪️', '🌊'],
  INFO_TITLE:['ℹ️', '📊', '📈', '📉', '📋', '📌', '📍', '🔖', '🏷️', '📎', '📄', '🗂️']
}

let sequenceCounters = { reacción: 0, bullet: 0, bot_title: 0, info_title: 0 }

function getNextEmoji(type) {
  const sequence = EMOJI_SEQUENCES[type]
  const key = type.toLowerCase()
  const emoji = sequence[sequenceCounters[key] % sequence.length]
  sequenceCounters[key] = (sequenceCounters[key] + 1) % sequence.length
  return emoji
}

function toElegantFont(text) {
  const mapping = {
    'A':'𝙰','B':'𝙱','C':'𝙲','D':'𝙳','E':'𝙴','F':'𝙵','G':'𝙶','H':'𝙷',
    'I':'𝙸','J':'𝙹','K':'𝙺','L':'𝙻','M':'𝙼','N':'𝙽','O':'𝙾','P':'𝙿',
    'Q':'𝚀','R':'𝚁','S':'𝚂','T':'𝚃','U':'𝚄','V':'𝚅','W':'𝚆','X':'𝚇',
    'Y':'𝚈','Z':'𝚉','1':'𝟷','8':'𝟾',' ':' '
  }
  return text.split('').map(c => mapping[c] || c).join('')
}

function clockString(ms) {
  let h = Math.floor(ms / 3600000)
  let m = Math.floor(ms / 60000) % 60
  let s = Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':')
}

function getHondurasInfo() {
  const now = new Date()
  const options = { timeZone: 'America/Tegucigalpa' }
  const hora = now.toLocaleString('es-HN', { ...options, hour: 'numeric', minute: '2-digit', hour12: true })
  const horaNum = parseInt(now.toLocaleString('en-US', { ...options, hour: 'numeric', hour12: false }))
  const saludo = horaNum >= 5 && horaNum < 12 ? 'Buenos días' : horaNum >= 12 && horaNum < 18 ? 'Buenas tardes' : 'Buenas noches'
  const fecha = now.toLocaleDateString('es-HN', { ...options, year: 'numeric', month: 'long', day: 'numeric' })
  return { hora, saludo, fecha }
}

// Medir longitud real de un string con caracteres especiales/emojis
function visLen(str) {
  return [...str].length
}

// Construir caja con cierre dinámico que iguala el ancho del header
function buildBox(title, lines, bullet) {
  const header = `╭━━〔 ${title} 〕━━╮`
  const w = visLen(header) - 2
  const footer = `╰${'━'.repeat(w)}╯`
  let txt = `${header}\n┃\n`
  for (const line of lines) {
    txt += `┃ ${bullet} ${line}\n`
  }
  txt += `┃\n${footer}\n`
  return txt
}

export default {
  command: ['menu', 'help', 'ayuda'],
  execute: async (sock, msg, { from, config: cfg }) => {
    try {
      const prefix = cfg?.prefix || global.config?.prefix || '.'
      const bullet    = getNextEmoji('BULLET')
      const reaccion  = getNextEmoji('REACCIÓN')
      const botTitle  = getNextEmoji('BOT_TITLE')
      const infoTitle = getNextEmoji('INFO_TITLE')

      await sock.sendMessage(from, { react: { text: reaccion, key: msg.key } })

      // Escanear plugins
      const cats = {}
      function scan(dir) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const full = path.join(dir, file)
          if (fs.statSync(full).isDirectory()) {
            scan(full)
          } else if (file.endsWith('.js')) {
            try {
              const content = fs.readFileSync(full, 'utf8')
              if (content.includes('command:')) {
                const folderName = path.basename(path.dirname(full))
                const cat = folderName === 'plugins' ? 'main' : folderName
                if (!cats[cat]) cats[cat] = []
                const match = content.match(/command:\s*\[\s*['"]([^'"]+)['"]/)
                if (match) cats[cat].push(match[1])
              }
            } catch {}
          }
        }
      }
      scan(pluginsDir)

      await new Promise(r => setTimeout(r, 400))

      const categoryMap = {
        'main':              '𝙿𝚁𝙸𝙽𝙲𝙸𝙿𝙰𝙻',
        'owner':             '𝙾𝚆𝙽𝙴𝚁',
        'administracion':    '𝙶𝚁𝚄𝙿𝙾𝚂',
        'descargas':         '𝙳𝙴𝚂𝙲𝙰𝚁𝙶𝙰𝚂',
        'busqueda':          '𝙱𝚄𝚂𝚀𝚄𝙴𝙳𝙰𝚂',
        'juegos':            '𝙹𝚄𝙴𝙶𝙾𝚂',
        'I-A-S':             '𝙸𝙰',
        'anime':             '𝙰𝙽𝙸𝙼𝙴',
        'random-reacciones': '𝚁𝙴𝙰𝙲𝙲𝙸𝙾𝙽𝙴𝚂',
        '+18':               '𝙲𝙾𝙽𝚃𝙴𝙽𝙸𝙳𝙾 +𝟷𝟾',
        'herramientas':      '𝙷𝙴𝚁𝚁𝙰𝙼𝙸𝙴𝙽𝚃𝙰𝚂',
        'economia':          '𝙴𝙲𝙾𝙽𝙾𝙼𝙸𝙰'
      }

      const { hora, saludo, fecha } = getHondurasInfo()
      const username = msg.pushName || 'amor'
      const uptime   = clockString(process.uptime() * 1000)
      const botName  = cfg?.botName || global.config?.botName || 'Midori-Hana'

      // Contar total de comandos
      const totalCmds = Object.values(cats).reduce((acc, arr) => acc + new Set(arr).size, 0)

      // ── Caja principal ──────────────────────────────────────
      const mainTitle = `${botTitle} ${toElegantFont(botName.replace(/©\s*/g, '').toUpperCase())} ${botTitle}`
      let menuTxt = buildBox(mainTitle, [
        `🫧 _${saludo}, ${username}_ 🫧`,
        `${bullet} ${fecha}`,
        `${bullet} ${hora} (HN)`
      ].map(l => l), '')
        .replace(/┃ \n/g, '┃\n')

      menuTxt += '\n'

      // ── Caja INFO ──────────────────────────────────────────
      menuTxt += buildBox(`${infoTitle} ${toElegantFont('INFO')} ${infoTitle}`, [
        `Creador: ${cfg?.ownerName || global.config?.ownerName || 'HERNANDEZ'}`,
        `Activo: ${uptime}`,
        `Prefix: ${Array.isArray(prefix) ? prefix.join('  ') : prefix}`,
        `Comandos: ${totalCmds}`
      ], bullet)

      menuTxt += '\n'

      // ── Categorías ─────────────────────────────────────────
      const orden = ['main','I-A-S','anime','random-reacciones','descargas','busqueda','herramientas','economia','juegos','administracion','+18','owner']

      for (const cat of orden) {
        const cmds = cats[cat]
        if (cmds?.length) {
          const catName = categoryMap[cat] || cat.toUpperCase()
          const cmdList = [...new Set(cmds)].sort().map(c => `${prefix}${c}`)
          menuTxt += buildBox(catName, cmdList, bullet)
          menuTxt += '\n'
        }
      }

      // ── Footer ─────────────────────────────────────────────
      menuTxt += `${bullet} ${toElegantFont(`${botName.replace(/©\s*/g, '').toUpperCase()} SISTEMA`)} ${bullet}\n`
      menuTxt += `🩷 Soporte: ${cfg?.soporte || global.config?.soporte}\n`
      menuTxt += `🌸 Grupo: ${cfg?.grupoOficial || global.config?.grupoOficial}`

      const randomImg = MENU_IMAGES[Math.floor(Math.random() * MENU_IMAGES.length)]

      try {
        await sock.sendMessage(from, {
          image: { url: randomImg },
          caption: menuTxt
        }, { quoted: msg })
      } catch {
        await sock.sendMessage(from, { text: menuTxt }, { quoted: msg })
      }

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '🍃 Error al generar el menú.' }, { quoted: msg })
    }
  }
}