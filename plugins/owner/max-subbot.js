import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

function updateMaxSubbots(newValue) {
  let content = fs.readFileSync(configPath, 'utf8')
  const lines = content.split('\n')
  
  const idx = lines.findIndex(l => l.match(/^\s*maxSubbots:/))
  
  if (idx !== -1) {
    lines[idx] = lines[idx].replace(/maxSubbots:\s*\d+/, `maxSubbots: ${newValue}`)
  } else {
    const lastIdx = lines.findIndex(l => l.match(/^\s*subbot:/))
    if (lastIdx !== -1) {
      lines.splice(lastIdx + 1, 0, `  maxSubbots: ${newValue},`)
    }
  }
  
  fs.writeFileSync(configPath, lines.join('\n'), 'utf8')
}

export default {
  command: ['maxsubbot', 'maxsb'],
  group: false,
  owner: true,

  async execute(sock, msg, { args, from }) {
    const num = parseInt(args[0])

    if (!args[0] || isNaN(num) || num < 1 || num > 20) {
      await sock.sendMessage(from, { 
        text: '> 🍃 *USO:* `.maxsb <1-20>`\n> Ejemplo: `.maxsb 5`' 
      }, { quoted: msg })
      return
    }

    const oldValue = global.config?.maxSubbots || 3
    updateMaxSubbots(num)
    
    global.config.maxSubbots = num

    await sock.sendMessage(from, { 
      text: `> ✅ *Límite de subbots actualizado*\n\n> 📌 Anterior: *${oldValue}*\n> 📌 Nuevo: *${num}*` 
    }, { quoted: msg })
    
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}