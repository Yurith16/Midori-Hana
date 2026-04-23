import { getGroupConfig, updateGroupConfig } from '../../database/db.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

async function enableConfigField(field) {
  let content = fs.readFileSync(configPath, 'utf8')
  const lines = content.split('\n')
  const idx = lines.findIndex(l => l.match(new RegExp(`^\\s*${field}:`)))
  if (idx !== -1) lines[idx] = lines[idx].replace(/:\s*(true|false)/, ': true')
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
  allowprivate: { key: 'allowPrivate', label: 'Mensajes privados' },
  subbot:       { key: 'subbot',       label: 'Sistema Subbot'   }
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

    if (!option) {
      let menu = `> 🍃 *CONFIGURACIÓN — ACTIVAR*\n\n`

      if (isAdmin || isOwner) {
        menu += `> *Opciones de grupo (admins)*\n`
        menu += `> 🔗 AntiLinks: ${cfg.antiLink ? '🟢 ON' : '🔴 OFF'} — \`.enable antilink\`\n`
        menu += `> 👮 Modo admin: ${cfg.adminMode ? '🟢 ON' : '🔴 OFF'} — \`.enable adminmode\`\n`
        menu += `> 👋 Bienvenidas: ${cfg.welcomeMessage ? '🟢 ON' : '🔴 OFF'} — \`.enable welcome\`\n`
        menu += `> 🔞 Contenido +18: ${cfg.nsfwEnabled ? '🟢 ON' : '🔴 OFF'} — \`.enable nsfw\`\n`
        menu += `> 🎭 Reacciones: ${cfg.reactionEnabled ? '🟢 ON' : '🔴 OFF'} — \`.enable reaction\`\n`
      }

      if (isOwner) {
        menu += `\n> *Opciones globales (owner)*\n`
        menu += `> 🔧 Mantenimiento: ${global.config.maintenance ? '🟢 ON' : '🔴 OFF'} — \`.enable maintenance\`\n`
        menu += `> 👁️ Auto leer: ${global.config.autoRead ? '🟢 ON' : '🔴 OFF'} — \`.enable autoread\`\n`
        menu += `> 🧬 Auto bio: ${global.config.autoBio ? '🟢 ON' : '🔴 OFF'} — \`.enable autobio\`\n`
        menu += `> 📵 Anti llamadas: ${global.config.antiCall ? '🟢 ON' : '🔴 OFF'} — \`.enable anticall\`\n`
        menu += `> 💬 Privados: ${global.config.allowPrivate ? '🟢 ON' : '🔴 OFF'} — \`.enable allowprivate\`\n`
        menu += `> 🤖 Subbots: ${global.config.subbot ? '🟢 ON' : '🔴 OFF'} — \`.enable subbot\`\n`
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
      await updateGroupConfig(from, { [key]: true })
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

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