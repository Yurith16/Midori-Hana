import { getRealJid, cleanNumber } from '../../utils/jid.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default {
  command: ['join', 'unete', 'unir'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, sender, args }) {
    try {
      const groupUrl = args[0]

      if (!groupUrl) {
        await sock.sendMessage(from, {
          text: '> ❌ *Uso incorrecto*\n> *Ejemplo:* .unete https://chat.whatsapp.com/xxxxx'
        }, { quoted: msg })
        return
      }

      if (!groupUrl.includes('chat.whatsapp.com')) {
        await sock.sendMessage(from, {
          text: '> ❌ *URL inválida*\n> Solo se permiten enlaces de invitación de WhatsApp'
        }, { quoted: msg })
        return
      }

      const realJid = await getRealJid(sock, sender, msg)
      const cleanUserNumber = cleanNumber(realJid)
      const userNumber = `+${cleanUserNumber}`

      // Leer config.js
      const configPath = path.join(__dirname, '../../config.js')
      let configContent = fs.readFileSync(configPath, 'utf8')
      const ownerMatch = configContent.match(/ownerNumbers:\s*\[['"](.+?)['"]\]/)

      if (!ownerMatch) {
        await sock.sendMessage(from, {
          text: '> ❌ *Error de configuración*'
        }, { quoted: msg })
        return
      }

      const ownerNumbers = ownerMatch[1].split(/['"],\s*['"]/).map(num => num.trim())

      // Notificar al usuario
      await sock.sendMessage(from, {
        text: `> 📨 *Solicitud enviada al owner*\n> ⏰ Espera respuesta, puede tardar unos minutos\n> 📱 *Tu número:* ${userNumber}`
      }, { quoted: msg })

      // Enviar solicitud a cada owner
      for (const ownerNumber of ownerNumbers) {
        const ownerJid = `${ownerNumber}@s.whatsapp.net`

        await sock.sendMessage(ownerJid, {
          text: `🔔 *NUEVA SOLICITUD DE UNIÓN*

👤 *Usuario:* ${userNumber}
🔗 *URL del grupo:* ${groupUrl}
📅 *Fecha:* ${new Date().toLocaleString()}

*Para aceptar, usa:*
\`.aceptar ${groupUrl}\``
        })
      }

    } catch (err) {
      console.error('Error:', err)
      await sock.sendMessage(from, {
        text: `> ❌ *Error:* ${err.message}`
      }, { quoted: msg })
    }
  }
}