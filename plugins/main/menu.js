import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import config from '../../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.join(__dirname, '../..', 'plugins')

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
    'L': '𝙻', 'B': '𝙱', 'F': '𝙵', 'W': '𝚆', 'X': '𝚇', 'Z': '𝚉',
    '1': '𝟷', '8': '𝟾'
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
  execute: async (sock, msg, { from, config: cfg }) => {
    try {
      const prefix = cfg.prefix || '.'
      const currentEmojis = {
        reacción: getNextEmoji('REACCIÓN'),
        bullet: getNextEmoji('BULLET'),
        botTitle: getNextEmoji('BOT_TITLE'),
        infoTitle: getNextEmoji('INFO_TITLE')
      }

      await sock.sendMessage(from, { react: { text: currentEmojis.reacción, key: msg.key } })

      const cats = {}
      
      function scan(dir) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const full = path.join(dir, file)
          if (fs.statSync(full).isDirectory()) {
            scan(full)
          } else if (file.endsWith('.js')) {
            try {
              const cmdFile = fs.readFileSync(full, 'utf8')
              if (cmdFile.includes('command:')) {
                const folderName = path.basename(path.dirname(full))
                const currentCat = folderName === 'plugins' ? 'main' : folderName
                if (!cats[currentCat]) cats[currentCat] = []
                
                const match = cmdFile.match(/command:\s*\[\s*['"]([^'"]+)['"]/)
                if (match) cats[currentCat].push(match[1])
              }
            } catch (e) {}
          }
        }
      }

      scan(pluginsDir)
      await new Promise(r => setTimeout(r, 400))

      const categoryMap = {
        'main': '𝙿𝚁𝙸𝙽𝙲𝙸𝙿𝙰𝙻',
        'owner': '𝙾𝚆𝙽𝙴𝚁',
        'administracion': '𝙶𝚁𝚄𝙿𝙾𝚂',
        'descargas': '𝙳𝙴𝚂𝙲𝙰𝚁𝙶𝙰𝚂',
        'busqueda': '𝙱𝚄𝚂𝚀𝚄𝙴𝙳𝙰𝚂', // Nueva categoría agregada
        'juegos': '𝙹𝚄𝙴𝙶𝙾𝚂',
        'I-A-S': '𝙸𝙽𝚃𝙴𝙻𝙸𝙶𝙴𝙽𝙲𝙸𝙰 𝙰𝚁𝚃𝙸𝙵𝙸𝙲𝙸𝙰𝙻',
        'anime': '𝙰𝙽𝙸𝙼𝙴',
        'random-reacciones': '𝚁𝙴𝙰𝙲𝙲𝙸𝙾𝙽𝙴𝚂',
        '+18': '𝙲𝙾𝙽𝚃𝙴𝙽𝙸𝙳𝙾 +𝟷𝟾',
        'herramientas': '𝙷𝙴𝚁𝚁𝙰𝙼𝙸𝙴𝙽𝚃𝙰𝚂'
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

      // Orden actualizado para incluir busqueda
      const orden = ['main', 'I-A-S', 'anime', 'random-reacciones', 'descargas', 'busqueda', 'herramientas', 'juegos', 'administracion', '+18', 'owner']
      
      for (const cat of orden) {
        const cmds = cats[cat]
        if (cmds && cmds.length) {
          const catName = categoryMap[cat] || cat.toUpperCase()
          menu += `╭━━〔 ${toElegantFont(catName)} 〕━━╮\n`
          menu += `┃\n`
          for (const c of [...new Set(cmds)].sort()) {
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
      await sock.sendMessage(from, { text: '🍃 Error al generar el menú.' }, { quoted: msg })
    }
  }
}