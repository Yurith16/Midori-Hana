import config from '../../config.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

export default {
  command: ['enable'],
  group: false,
  owner: true,

  async execute(sock, msg, { args, from }) {
    if (args.length === 0 || args[0] !== 'private') {
      const estado = config.allowPrivate ? '✅ ACTIVADO' : '❌ DESACTIVADO'
      await sock.sendMessage(from, { 
        text: `🔐 *Estado del bot en privado*\n\n${estado}\n\n📌 Usa:\n.enable private - Activar\n.disable private - Desactivar` 
      }, { quoted: msg })
      return
    }

    try {
      let configContent = fs.readFileSync(configPath, 'utf8')
      const regex = /allowPrivate:\s*(true|false)/
      configContent = configContent.replace(regex, `allowPrivate: true`)
      fs.writeFileSync(configPath, configContent, 'utf8')
      config.allowPrivate = true

      await sock.sendMessage(from, { 
        text: '✅ *COMANDOS EN PRIVADO ACTIVADOS*\n\nAhora el bot responderá comandos en privado.' 
      }, { quoted: msg })

    } catch (error) {
      await sock.sendMessage(from, { 
        text: `❌ Error: ${error.message}` 
      }, { quoted: msg })
    }
  }
}