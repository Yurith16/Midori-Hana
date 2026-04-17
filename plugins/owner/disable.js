import { getGroupConfig, updateGroupConfig } from '../../database/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

async function disableConfigField(field) {
  let content = fs.readFileSync(configPath, 'utf8')
  const lines = content.split('\n')
  const idx = lines.findIndex(l => l.match(new RegExp(`^\\s*${field}:`)))
  if (idx !== -1) lines[idx] = lines[idx].replace(/:\s*(true|false)/, ': false')
  fs.writeFileSync(configPath, lines.join('\n'), 'utf8')
}

const adminOpts = {
  antilink:  { key: 'antiLink',       label: 'AntiLinks'      },
  adminmode: { key: 'adminMode',      label: 'Modo admin'     },
  welcome:   { key: 'welcomeMessage', label: 'Bienvenidas'    },
  nsfw:      { key: 'nsfwEnabled',    label: 'Contenido +18'  },
  reaction:  { key: 'reactionEnabled', label: 'Reacciones'    }
}

const ownerOpts = {
  maintenance:  { key: 'maintenance',  label: 'Mantenimiento'    },
  autoread:     { key: 'autoRead',     label: 'Auto leer'        },
  autobio:      { key: 'autoBio',      label: 'Auto bio'         },
  anticall:     { key: 'antiCall',     label: 'Anti llamadas'    },
  allowprivate: { key: 'allowPrivate', label: 'Mensajes privados' }
}

export default {
  command: ['disable'],
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

    if (!option) {
      let menu = `> 🍃 *CONFIGURACIÓN — DESACTIVAR*\n\n`

      if (isAdmin || isOwner) {
        menu += `> *Opciones de grupo (admins)*\n`
        menu += `> 🔗 AntiLinks: ${cfg.antiLink ? '🟢 ON' : '🔴 OFF'} — \`.disable antilink\`\n`
        menu += `> 👮 Modo admin: ${cfg.adminMode ? '🟢 ON' : '🔴 OFF'} — \`.disable adminmode\`\n`
        menu += `> 👋 Bienvenidas: ${cfg.welcomeMessage ? '🟢 ON' : '🔴 OFF'} — \`.disable welcome\`\n`
        menu += `> 🔞 Contenido +18: ${cfg.nsfwEnabled ? '🟢 ON' : '🔴 OFF'} — \`.disable nsfw\`\n`
        menu += `> 🎭 Reacciones: ${cfg.reactionEnabled ? '🟢 ON' : '🔴 OFF'} — \`.disable reaction\`\n`
      }

      if (isOwner) {
        menu += `\n> *Opciones globales (owner)*\n`
        menu += `> 🔧 Mantenimiento: ${global.config.maintenance ? '🟢 ON' : '🔴 OFF'} — \`.disable maintenance\`\n`
        menu += `> 👁️ Auto leer: ${global.config.autoRead ? '🟢 ON' : '🔴 OFF'} — \`.disable autoread\`\n`
        menu += `> 🧬 Auto bio: ${global.config.autoBio ? '🟢 ON' : '🔴 OFF'} — \`.disable autobio\`\n`
        menu += `> 📵 Anti llamadas: ${global.config.antiCall ? '🟢 ON' : '🔴 OFF'} — \`.disable anticall\`\n`
        menu += `> 💬 Privados: ${global.config.allowPrivate ? '🟢 ON' : '🔴 OFF'} — \`.disable allowprivate\`\n`
      }

      if (!isAdmin && !isOwner) {
        menu = '> 🚫 No tienes permisos para usar este comando 🍃'
      }

      await sock.sendMessage(from, { text: menu }, { quoted: msg })
      return
    }

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
      await updateGroupConfig(from, { [key]: false })
      await sock.sendMessage(from, { text: `> 🍃 *${label}* desactivado 🔴` }, { quoted: msg })
      return
    }

    if (ownerOpts[option]) {
      if (!isOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> Solo el owner puede cambiar esta opción 🍃' }, { quoted: msg })
        return
      }
      const { key, label } = ownerOpts[option]
      await disableConfigField(key)
      await sock.sendMessage(from, { text: `> 🍃 *${label}* desactivado 🔴` }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '> Opción no válida 🍃' }, { quoted: msg })
  }
}