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

function toMono(text) {
  const map = {
    A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',
    K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',
    U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉',
    a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',
    k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',
    u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',' ':' '
  }
  return text.split('').map(c => map[c] || c).join('')
}

function toBold(text) {
  const map = {
    A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',
    K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',
    U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭',
    a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',
    k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',
    u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',' ':' '
  }
  return text.split('').map(c => map[c] || c).join('')
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

const div = `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`

// Cada categoría = su propia cajita idéntica al diseño de redes
function buildCatBox(catName, cmds, bullet, prefix) {
  let txt = `╭─〔 ${toBold(catName)} 〕\n`
  txt += `│\n`
  for (const cmd of cmds) {
    txt += `│ ${bullet} ${cmd}\n`
  }
  txt += `│\n`
  txt += `╰─────────────────\n`
  return txt
}

export default {
  command: ['menu', 'help', 'ayuda'],
  execute: async (sock, msg, { from, config: cfg }) => {
    try {
      const prefix    = cfg?.prefix || global.config?.prefix || '.'
      const bullet    = getNextEmoji('BULLET')
      const reaccion  = getNextEmoji('REACCIÓN')
      const botTitle  = getNextEmoji('BOT_TITLE')
      const infoTitle = getNextEmoji('INFO_TITLE')

      await sock.sendMessage(from, { react: { text: reaccion, key: msg.key } })

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

      const categoryMap = {
        main: 'Principal', 'I-A-S': 'Inteligencia Artificial', anime: 'Anime',
        'random-reacciones': 'Reacciones', descargas: 'Descargas', busqueda: 'Busquedas',
        herramientas: 'Herramientas', economia: 'Economia', juegos: 'Juegos',
        social: 'Social', administracion: 'Grupos', '+18': 'Contenido +18', owner: 'Owner'
      }

      const { hora, saludo, fecha } = getHondurasInfo()
      const username  = msg.pushName || 'amor'
      const uptime    = clockString(process.uptime() * 1000)
      const botName   = cfg?.botName || global.config?.botName || 'Midori-Hana'
      const totalCmds = Object.values(cats).reduce((acc, arr) => acc + new Set(arr).size, 0)

      // ── Encabezado principal ──
      let menuTxt = `╭─〔 ${botTitle} *${toMono(botName.replace(/©\s*/g, '').toUpperCase())}* ${botTitle} 〕\n`
      menuTxt += `│\n`
      menuTxt += `│ 🫧 _${saludo}, ${username}_ 🫧\n`
      menuTxt += `│ ${bullet} ${fecha}\n`
      menuTxt += `│ ${bullet} ${hora} (HN)\n`
      menuTxt += `│\n`
      menuTxt += `╰─────────────────\n\n`

      // ── Caja de info ──
      menuTxt += `╭─〔 ${infoTitle} ${toBold('Info del Bot')} ${infoTitle} 〕\n`
      menuTxt += `│\n`
      menuTxt += `│ ${bullet} Creador: ${cfg?.ownerName || global.config?.ownerName || 'HERNANDEZ'}\n`
      menuTxt += `│ ${bullet} Activo: ${uptime}\n`
      menuTxt += `│ ${bullet} Prefix: ${Array.isArray(prefix) ? prefix.join('  ') : prefix}\n`
      menuTxt += `│ ${bullet} Comandos: ${totalCmds}\n`
      menuTxt += `│\n`
      menuTxt += `╰─────────────────\n\n`

      // ── Una cajita por categoría ──
      const orden = ['main','I-A-S','anime','random-reacciones','descargas','busqueda','herramientas','economia','juegos','social','administracion','+18','owner']
      for (const cat of orden) {
        const cmds = cats[cat]
        if (cmds?.length) {
          const catName = categoryMap[cat] || cat
          const cmdList = [...new Set(cmds)].sort().map(c => `${prefix}${c}`)
          menuTxt += buildCatBox(catName, cmdList, bullet, prefix)
          menuTxt += '\n'
        }
      }

      // ── Pie ──
      menuTxt += `> *${toMono(botName)} ™* 🌸`

      const randomImg = MENU_IMAGES[Math.floor(Math.random() * MENU_IMAGES.length)]
      await sock.sendMessage(from, { image: { url: randomImg }, caption: menuTxt }, { quoted: msg })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '🍃 Error al generar el menú.' }, { quoted: msg })
    }
  }
}