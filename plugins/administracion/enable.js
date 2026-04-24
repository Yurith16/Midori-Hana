import { getGroupConfig, updateGroupConfig, updateSubbotSettings, getSubbotSettings } from '../../database/db.js'
//import { forceReloadConfig } from '../../handler.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

async function enableConfigField(field) {
  let content = fs.readFileSync(configPath, 'utf8')
  const lines  = content.split('\n')
  const idx    = lines.findIndex(l => l.match(new RegExp(`^\\s*${field}:`)))
  if (idx !== -1) lines[idx] = lines[idx].replace(/:\s*(true|false)/, ': true')
  fs.writeFileSync(configPath, lines.join('\n'), 'utf8')
  await forceReloadConfig()
}

const adminOpts = {
  antilink:  { key: 'antiLink',        label: 'AntiLinks'      },
  adminmode: { key: 'adminMode',       label: 'Modo admin'     },
  welcome:   { key: 'welcomeMessage',  label: 'Bienvenidas'    },
  nsfw:      { key: 'nsfwEnabled',     label: 'Contenido +18'  },
  reaction:  { key: 'reactionEnabled', label: 'Reacciones'     }
}

const ownerOpts = {
  maintenance:  { key: 'maintenance',  label: 'Mantenimiento'     },
  autoread:     { key: 'autoRead',     label: 'Auto leer'         },
  autobio:      { key: 'autoBio',      label: 'Auto bio'          },
  anticall:     { key: 'antiCall',     label: 'Anti llamadas'     },
  allowprivate: { key: 'allowPrivate', label: 'Mensajes privados' },
  subbot:       { key: 'subbot',       label: 'Sistema Subbot'    }
}

export default {
  command: ['enable'],
  group:   false,
  owner:   false,

  async execute(sock, msg, { args, from, isOwner, isSubbotOwner, subbotNumero }) {
    const metadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null
    const sender   = msg.key.participant || msg.key.remoteJid
    const isAdmin  = metadata
      ? metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
        metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'
      : false

    const cfg    = metadata ? getGroupConfig(from) : {}
    const option = args[0]?.toLowerCase()

    // Settings actuales para mostrar estado correcto
    const sbSettings = subbotNumero ? await getSubbotSettings(subbotNumero) : null

    if (!option) {
      let menu = `> 🍃 *CONFIGURACIÓN — ACTIVAR*\n\n`
      if (isAdmin || isOwner || isSubbotOwner) {
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
      if (isSubbotOwner && sbSettings) {
        menu += `\n> *Opciones de mi subbot*\n`
        menu += `> 👁️ Auto leer: ${sbSettings.autoRead ? '🟢 ON' : '🔴 OFF'} — \`.enable autoread\`\n`
        menu += `> 🧬 Auto bio: ${sbSettings.autoBio ? '🟢 ON' : '🔴 OFF'} — \`.enable autobio\`\n`
        menu += `> 📵 Anti llamadas: ${sbSettings.antiCall ? '🟢 ON' : '🔴 OFF'} — \`.enable anticall\`\n`
        menu += `> 💬 Privados: ${sbSettings.allowPrivate ? '🟢 ON' : '🔴 OFF'} — \`.enable allowprivate\`\n`
      }
      if (!isAdmin && !isOwner && !isSubbotOwner) {
        menu = '> 🚫 No tienes permisos para usar este comando 🍃'
      }
      await sock.sendMessage(from, { text: menu }, { quoted: msg })
      return
    }

    if (adminOpts[option]) {
      if (!isAdmin && !isOwner && !isSubbotOwner) {
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
      // Si es subbot owner, guarda en su propia DB
      if (isSubbotOwner && subbotNumero) {
        const { key, label } = ownerOpts[option]
        // subbot no puede tocar subbot ni maintenance
        if (key === 'subbot' || key === 'maintenance') {
          await sock.sendMessage(from, { text: '> ❌ No puedes cambiar esta opción desde un subbot.' }, { quoted: msg })
          return
        }
        await updateSubbotSettings(subbotNumero, { [key]: true })
        await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
        return
      }

      // Bot principal — solo el owner principal
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