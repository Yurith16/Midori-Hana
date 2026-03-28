import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import config from '../../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.join(__dirname, '../..', 'plugins')

// Emojis rotativos
const EMOJI_SEQUENCES = {
  REACCIÓN: ['🌿', '🍃', '🍀', '🌱', '🌼', '🌸', '🌺', '💮', '🥀', '🌻', '🌹', '🌷', '🏵️'],
  BULLET: ['🍃', '🌱', '🍀', '🌿', '🌼', '🌸', '🌺', '🌻', '🌹', '🌷', '☘️', '🥀', '💐'],
  BOT_TITLE: ['🔥', '🌟', '✨', '⭐', '💫', '⚡', '💥', '🌪️', '🌊'],
  INFO_TITLE: ['ℹ️', '📊', '📈', '📉', '📋', '📌', '📍', '🔖', '🏷️', '📎', '📄', '🗂️']
}

let sequenceCounters = { reacción: 0, bullet: 0, bot_title: 0, info_title: 0 }

function getNextEmoji(type) {
  const sequence = EMOJI_SEQUENCES[type]
  const counterKey = type.toLowerCase()
  const emoji = sequence[sequenceCounters[counterKey] % sequence.length]
  sequenceCounters[counterKey] = (sequenceCounters[counterKey] + 1) % sequence.length
  return emoji
}

function toElegantFont(text) {
  const mapping = {
    'M': '𝙼', 'I': '𝙸', 'N': '𝙽', 'K': '𝙺', 'A': '𝙰', 'R': '𝚁',
    'S': '𝚂', 'Y': '𝚈', 'T': '𝚃', 'E': '𝙴', 'C': '𝙲', 'D': '𝙳',
    'O': '𝙾', 'P': '𝙿', 'G': '𝙶', 'U': '𝚄', 'V': '𝚅', 'H': '𝙷',
    'L': '𝙻', 'B': '𝙱', 'F': '𝙵', 'W': '𝚆', 'X': '𝚇', 'Z': '𝚉'
  }
  return text.split("").map((char) => mapping[char] || char).join("")
}

function clockString(ms) {
  let h = Math.floor(ms / 3600000)
  let m = Math.floor(ms / 60000) % 60
  let s = Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(":")
}

function getHondurasInfo() {
  const hora = new Date().toLocaleString('es-US', { 
    timeZone: 'America/Tegucigalpa',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  
  const horaNum = parseInt(new Date().toLocaleString('es-US', { 
    timeZone: 'America/Tegucigalpa',
    hour: 'numeric',
    hour12: false 
  }))
  
  let saludo = ''
  if (horaNum >= 5 && horaNum < 12) saludo = 'Buenos días'
  else if (horaNum >= 12 && horaNum < 18) saludo = 'Buenas tardes'
  else saludo = 'Buenas noches'
  
  const fecha = new Date().toLocaleDateString('es-US', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  
  return { hora, saludo, fecha }
}

export default {
  command: ['menu', 'help', 'ayuda'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, config: cfg }) {
    try {
      const prefix = cfg.prefix || '.'
      const currentEmojis = {
        reacción: getNextEmoji('REACCIÓN'),
        bullet: getNextEmoji('BULLET'),
        botTitle: getNextEmoji('BOT_TITLE'),
        infoTitle: getNextEmoji('INFO_TITLE')
      }

      await sock.sendMessage(from, { react: { text: currentEmojis.reacción, key: msg.key } })

      // Escanear comandos
      const cats = {}
      
      function scan(dir, cat) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const full = path.join(dir, file)
          if (fs.statSync(full).isDirectory()) {
            scan(full, file)
          } else if (file.endsWith('.js')) {
            import(`file://${full}`).then(p => {
              const cmd = p.default
              if (cmd?.command) {
                if (!cats[cat]) cats[cat] = []
                const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
                cats[cat].push(names[0])
              }
            }).catch(() => {})
          }
        }
      }

      scan(pluginsDir, 'main')
      await new Promise(r => setTimeout(r, 500))

      // Mapeo de carpetas a categorías elegantes
      const categoryMap = {
        'main': '𝙿𝚁𝙸𝙽𝙲𝙸𝙿𝙰𝙻',
        'owner': '𝙾𝚆𝙽𝙴𝚁',
        'administracion': '𝙶𝚁𝚄𝙿𝙾𝚂',
        'descargas': '𝙳𝙴𝚂𝙲𝙰𝚁𝙶𝙰𝚂',
        'juegos': '𝙹𝚄𝙴𝙶𝙾𝚂'
      }

      const { hora, saludo, fecha } = getHondurasInfo()
      const username = msg.pushName || 'amor'
      const uptime = clockString(process.uptime() * 1000)
      
      let menu = `╭━〔 ${currentEmojis.botTitle} ${toElegantFont(cfg.botName.toUpperCase())} ${currentEmojis.botTitle} 〕━╮\n`
      menu += `┃\n`
      menu += `┃ 🫧 _${saludo}, ${username}_ 🫧\n`
      menu += `┃ ${currentEmojis.bullet} ${fecha}\n`
      menu += `┃ ${currentEmojis.bullet} ${hora} (HN)\n`
      menu += `┃\n`
      menu += `╰━━━━━━━━━━━━━━━━━━╯\n\n`
      
      menu += `╭━━〔 ${currentEmojis.infoTitle} ${toElegantFont('𝙸𝙽𝙵𝙾')} ${currentEmojis.infoTitle} 〕━━╮\n`
      menu += `┃\n`
      menu += `┃ ${currentEmojis.bullet} Creador: ${cfg.ownerName}\n`
      menu += `┃ ${currentEmojis.bullet} Activo: ${uptime}\n`
      menu += `┃ ${currentEmojis.bullet} Prefix: ${prefix}\n`
      menu += `┃\n`
      menu += `╰━━━━━━━━━━━━━━━━━━╯\n\n`

      // Secciones de comandos por carpeta
      for (const [cat, cmds] of Object.entries(cats)) {
        if (cmds.length) {
          const catName = categoryMap[cat] || cat.toUpperCase()
          menu += `╭━━〔 ${toElegantFont(catName)} 〕━━╮\n`
          menu += `┃\n`
          for (const c of cmds.sort()) {
            menu += `┃ ${currentEmojis.bullet} ${prefix}${c}\n`
          }
          menu += `┃\n`
          menu += `╰━━━━━━━━━━━━━━━━━━╯\n\n`
        }
      }

      menu += `${currentEmojis.bullet} ${toElegantFont(`${cfg.botName.toUpperCase()} SISTEMA`)} ${currentEmojis.bullet}\n`
      menu += `🩷 Soporte: ${cfg.soporte}\n`
      menu += `🌸 Grupo: ${cfg.grupoOficial}`

      await sock.sendMessage(from, { text: menu }, { quoted: msg })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '🍃 Error al generar el menú.' }, { quoted: msg })
    }
  }
}