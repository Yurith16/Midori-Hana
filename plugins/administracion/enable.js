import { getGroupConfig, updateGroupConfig } from '../../database/db.js'
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

  async execute(sock, msg, { args, from, config: cfg, isOwner, subbotNumero }) {
    if (subbotNumero) {
      await sock.sendMessage(from, { 
        text: `> 🍃 *Los subbots usan comandos exclusivos*\n\n> Para activar opciones en tu subbot usa:\n> 📌 \`.sbenable\`\n> 📌 \`.sbdisable\`` 
      }, { quoted: msg })
      return
    }

    const metadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null
    const sender   = msg.key.participant || msg.key.remoteJid
    const isAdmin  = metadata
      ? metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
        metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'
      : false

    const groupCfg = metadata ? getGroupConfig(from) : {}
    const option   = args[0]?.toLowerCase()

    const botName = cfg?.botName || global.config?.botName || 'Midori-Hana'

    function toMono(text) {
      const map = {
        A:'𝙰',B:'𝙱',C:'𝙲',D:'𝙳',E:'𝙴',F:'𝙵',G:'𝙶',H:'𝙷',I:'𝙸',J:'𝙹',
        K:'𝙺',L:'𝙻',M:'𝙼',N:'𝙽',O:'𝙾',P:'𝙿',Q:'𝚀',R:'𝚁',S:'𝚂',T:'𝚃',
        U:'𝚄',V:'𝚅',W:'𝚆',X:'𝚇',Y:'𝚈',Z:'𝚉',
        a:'𝚊',b:'𝚋',c:'𝚌',d:'𝚍',e:'𝚎',f:'𝚏',g:'𝚐',h:'𝚑',i:'𝚒',j:'𝚓',
        k:'𝚔',l:'𝚕',m:'𝚖',n:'𝚗',o:'𝚘',p:'𝚙',q:'𝚚',r:'𝚛',s:'𝚜',t:'𝚝',
        u:'𝚞',v:'𝚟',w:'𝚠',x:'𝚡',y:'𝚢',z:'𝚣',' ':' '
      }
      return text.split('').map(c => map[c] || c).join('')
    }

    function toBold(text) {
      const map = {
        A:'𝗔',B:'𝗕',C:'𝗖',D:'𝗗',E:'𝗘',F:'𝗙',G:'𝗚',H:'𝗛',I:'𝗜',J:'𝗝',
        K:'𝗞',L:'𝗟',M:'𝗠',N:'𝗡',O:'𝗢',P:'𝗣',Q:'𝗤',R:'𝗥',S:'𝗦',T:'𝗧',
        U:'𝗨',V:'𝗩',W:'𝗪',X:'𝗫',Y:'𝗬',Z:'𝗭',
        a:'𝗮',b:'𝗯',c:'𝗰',d:'𝗱',e:'𝗲',f:'𝗳',g:'𝗴',h:'𝗵',i:'𝗶',j:'𝗷',
        k:'𝗸',l:'𝗹',m:'𝗺',n:'𝗻',o:'𝗼',p:'𝗽',q:'𝗾',r:'𝗿',s:'𝘀',t:'𝘁',
        u:'𝘂',v:'𝘃',w:'𝘄',x:'𝘅',y:'𝘆',z:'𝘇',' ':' '
      }
      return text.split('').map(c => map[c] || c).join('')
    }

    const div = `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`
    const imageUrl = 'https://www.image2url.com/r2/default/images/1776639876334-87e327fb-c225-42d5-bf68-a594f976fb49.jpg'

    if (!option) {
      let txt = `╭─〔 🌸 *${toMono(botName.toUpperCase())}* 🌸 〕\n`
      txt += `│\n`

      if (isAdmin || isOwner) {
        txt += `│ 📌 ${toBold('Opciones de grupo')}\n`
        txt += `│ ${div}\n`
        for (const [key, opt] of Object.entries(adminOpts)) {
          const estado = groupCfg[opt.key] ? '🟢 ON' : '🔴 OFF'
          txt += `> │ ${opt.label}: ${estado}  →  .enable ${key}\n`
          txt += `> │\n`
        }
      }

      if (isOwner) {
        if (isAdmin || isOwner) txt += `> │\n`
        txt += `│ 📌 ${toBold('Opciones globales')}\n`
        txt += `│ ${div}\n`
        for (const [key, opt] of Object.entries(ownerOpts)) {
          const estado = global.config[opt.key] ? '🟢 ON' : '🔴 OFF'
          txt += `> │ ${opt.label}: ${estado}  →  .enable ${key}\n`
          txt += `> │\n`
        }
      }

      if (!isAdmin && !isOwner) {
        txt += `│ 🚫 No tienes permisos\n`
        txt += `│\n`
      }

      txt += `╰─── *${toMono(botName)} ™* 🌸`

      await sock.sendMessage(from, { image: { url: imageUrl }, caption: txt }, { quoted: msg })
      return
    }

    if (adminOpts[option]) {
      if (!isAdmin && !isOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> 🍃 No tienes permisos' }, { quoted: msg })
        return
      }
      if (!metadata) {
        await sock.sendMessage(from, { text: '> 🍃 Este comando solo funciona en grupos' }, { quoted: msg })
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
        await sock.sendMessage(from, { text: '> 🍃 Solo el owner puede cambiar esto' }, { quoted: msg })
        return
      }
      const { key, label } = ownerOpts[option]
      await enableConfigField(key)
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '> 🍃 Opción no válida' }, { quoted: msg })
  }
}