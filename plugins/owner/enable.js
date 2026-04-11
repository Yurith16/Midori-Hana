import { getGroupConfig, updateGroupConfig } from '../../database/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

// Escribe un campo booleano en config.js en tiempo real
async function enableConfigField(field) {
  let content = fs.readFileSync(configPath, 'utf8')
  const regex = new RegExp(`(${field}:\\s*)(true|false)`)
  content = content.replace(regex, `$1true`)
  fs.writeFileSync(configPath, content, 'utf8')
}

// Opciones de admins (DB por grupo)
const adminOpts = {
  antilink:  { key: 'antiLink',       label: 'AntiLinks'      },
  adminmode: { key: 'adminMode',      label: 'Modo admin'     },
  welcome:   { key: 'welcomeMessage', label: 'Bienvenidas'    }
}

// Opciones de owner (config.js global)
const ownerOpts = {
  maintenance:  { key: 'maintenance',  label: 'Mantenimiento'   },
  autoread:     { key: 'autoRead',     label: 'Auto leer'       },
  autobio:      { key: 'autoBio',      label: 'Auto bio'        },
  anticall:     { key: 'antiCall',     label: 'Anti llamadas'   },
  allowprivate: { key: 'allowPrivate', label: 'Mensajes privados' }
}

export default {
  command: ['enable'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, isOwner }) {
    const metadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null
    const sender = msg.key.participant || msg.key.remoteJid
    const isAdmin = metadata
      ? metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
        metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'
      : false

    const cfg = metadata ? getGroupConfig(from) : {}
    const option = args[0]?.toLowerCase()

    // Sin argumento → mostrar menú según rol
    if (!option) {
      let menu = `> 🍃 *CONFIGURACIÓN — ACTIVAR*\n\n`

      if (isAdmin || isOwner) {
        menu += `> *Opciones de grupo (admins)*\n`
        menu += `> 🔗 AntiLinks: ${cfg.antiLink ? '🟢 ON' : '🔴 OFF'} — \`.enable antilink\`\n`
        menu += `> 👮 Modo admin: ${cfg.adminMode ? '🟢 ON' : '🔴 OFF'} — \`.enable adminmode\`\n`
        menu += `> 👋 Bienvenidas: ${cfg.welcomeMessage ? '🟢 ON' : '🔴 OFF'} — \`.enable welcome\`\n`
      }

      if (isOwner) {
        menu += `\n> *Opciones globales (owner)*\n`
        menu += `> 🔧 Mantenimiento: ${global.config.maintenance ? '🟢 ON' : '🔴 OFF'} — \`.enable maintenance\`\n`
        menu += `> 👁️ Auto leer: ${global.config.autoRead ? '🟢 ON' : '🔴 OFF'} — \`.enable autoread\`\n`
        menu += `> 🧬 Auto bio: ${global.config.autoBio ? '🟢 ON' : '🔴 OFF'} — \`.enable autobio\`\n`
        menu += `> 📵 Anti llamadas: ${global.config.antiCall ? '🟢 ON' : '🔴 OFF'} — \`.enable anticall\`\n`
        menu += `> 💬 Privados: ${global.config.allowPrivate ? '🟢 ON' : '🔴 OFF'} — \`.enable allowprivate\`\n`
      }

      if (!isAdmin && !isOwner) {
        menu = '> 🚫 No tienes permisos para usar este comando 🍃'
      }

      await sock.sendMessage(from, { text: menu }, { quoted: msg })
      return
    }

    // Opción de admin (DB)
    if (adminOpts[option]) {
      if (!isAdmin && !isOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
        return
      }
      if (!metadata) {
        await sock.sendMessage(from, { text: '> Este comando solo funciona en grupos 🍃' }, { quoted: msg })
        return
      }
      const { key, label } = adminOpts[option]
      await updateGroupConfig(from, { [key]: true })
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

    // Opción de owner (config.js)
    if (ownerOpts[option]) {
      if (!isOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> Solo el owner puede cambiar esta opción 🍃' }, { quoted: msg })
        return
      }
      const { key, label } = ownerOpts[option]
      await enableConfigField(key)
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '> Opción no válida 🍃' }, { quoted: msg })
  }
}