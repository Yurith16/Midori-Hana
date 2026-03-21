import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import config from '../../config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.join(__dirname, '../..', 'plugins')

export default {
  command: ['menu', 'help'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, prefix }) {
    try {
      await sock.sendMessage(from, { react: { text: '✨', key: msg.key } })

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

      const username = msg.pushName || "Usuario"
      const fecha = new Date().toLocaleDateString('es-ES')
      const p = prefix || '.'

      let menu = `✨ ${config.botName.toUpperCase()} ✨\n`
      menu += `→ Hola ${username}\n`
      menu += `→ ${fecha}\n`
      menu += `→ Prefix: ${p}\n`
      menu += `→ Owner: ${config.ownerName}\n\n`

      let total = 0
      for (const [cat, cmds] of Object.entries(cats)) {
        if (cmds.length) {
          menu += `► ${cat.toUpperCase()} (${cmds.length})\n`
          for (const c of cmds.sort()) {
            menu += `   ↳ ${p}${c}\n`
          }
          menu += `\n`
          total += cmds.length
        }
      }

      menu += `► TOTAL: ${total} comandos\n`
      menu += `© ${config.botName}`

      await sock.sendMessage(from, { text: menu }, { quoted: msg })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: '❌ Error' }, { quoted: msg })
    }
  }
}