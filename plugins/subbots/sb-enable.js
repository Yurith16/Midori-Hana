import { getSubbotGroupConfig, updateSubbotGroupConfig, getSubbotSettings, updateSubbotSettings } from '../../database/db-subbot.js'

const adminOpts = {
  antilink:  { key: 'antiLink',        label: 'AntiLinks'      },
  adminmode: { key: 'adminMode',       label: 'Modo admin'     },
  welcome:   { key: 'welcomeMessage',  label: 'Bienvenidas'    },
  nsfw:      { key: 'nsfwEnabled',     label: 'Contenido +18'  },
  reaction:  { key: 'reactionEnabled', label: 'Reacciones'     }
}

const subbotOpts = {
  autoread:     { key: 'autoRead',     label: 'Auto leer'         },
  autobio:      { key: 'autoBio',      label: 'Auto bio'          },
  anticall:     { key: 'antiCall',     label: 'Anti llamadas'     },
  antispam:     { key: 'antiSpam',     label: 'Anti spam'         },
  allowprivate: { key: 'allowPrivate', label: 'Mensajes privados' }
}

export default {
  command: ['sbenable'],
  group:   false,
  owner:   false,

  async execute(sock, msg, { args, from, isOwner, isSubbotOwner, subbotNumero }) {
    if (!subbotNumero) {
      await sock.sendMessage(from, { text: '> ❌ Este comando solo funciona en subbots.' }, { quoted: msg })
      return
    }

    const metadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null
    const sender   = msg.key.participant || msg.key.remoteJid
    const isAdmin  = metadata
      ? metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
        metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'
      : false

    const groupCfg   = metadata ? await getSubbotGroupConfig(subbotNumero, from) : {}
    const sbSettings = await getSubbotSettings(subbotNumero)
    const option     = args[0]?.toLowerCase()

    if (!option) {
      let menu = `> 🍃 *SUBBOT — ACTIVAR*\n\n`
      if (isAdmin || isOwner || isSubbotOwner) {
        menu += `> *Opciones de grupo*\n`
        menu += `> 🔗 AntiLinks: ${groupCfg.antiLink ? '🟢 ON' : '🔴 OFF'} — \`.sbenable antilink\`\n`
        menu += `> 👮 Modo admin: ${groupCfg.adminMode ? '🟢 ON' : '🔴 OFF'} — \`.sbenable adminmode\`\n`
        menu += `> 👋 Bienvenidas: ${groupCfg.welcomeMessage ? '🟢 ON' : '🔴 OFF'} — \`.sbenable welcome\`\n`
        menu += `> 🔞 Contenido +18: ${groupCfg.nsfwEnabled ? '🟢 ON' : '🔴 OFF'} — \`.sbenable nsfw\`\n`
        menu += `> 🎭 Reacciones: ${groupCfg.reactionEnabled ? '🟢 ON' : '🔴 OFF'} — \`.sbenable reaction\`\n`
      }
      if (isOwner || isSubbotOwner) {
        menu += `\n> *Opciones del subbot*\n`
        menu += `> 👁️ Auto leer: ${sbSettings.autoRead ? '🟢 ON' : '🔴 OFF'} — \`.sbenable autoread\`\n`
        menu += `> 🧬 Auto bio: ${sbSettings.autoBio ? '🟢 ON' : '🔴 OFF'} — \`.sbenable autobio\`\n`
        menu += `> 📵 Anti llamadas: ${sbSettings.antiCall ? '🟢 ON' : '🔴 OFF'} — \`.sbenable anticall\`\n`
        menu += `> 🛡️ Anti spam: ${sbSettings.antiSpam ? '🟢 ON' : '🔴 OFF'} — \`.sbenable antispam\`\n`
        menu += `> 💬 Privados: ${sbSettings.allowPrivate ? '🟢 ON' : '🔴 OFF'} — \`.sbenable allowprivate\`\n`
      }
      if (!isAdmin && !isOwner && !isSubbotOwner) {
        menu = '> 🚫 No tienes permisos 🍃'
      }
      await sock.sendMessage(from, { text: menu }, { quoted: msg })
      return
    }

    if (adminOpts[option]) {
      if (!isAdmin && !isOwner && !isSubbotOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> No tienes permisos 🍃' }, { quoted: msg })
        return
      }
      if (!metadata) {
        await sock.sendMessage(from, { text: '> Este comando solo funciona en grupos 🍃' }, { quoted: msg })
        return
      }
      const { key, label } = adminOpts[option]
      await updateSubbotGroupConfig(subbotNumero, from, { [key]: true })
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

    if (subbotOpts[option]) {
      if (!isOwner && !isSubbotOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> Solo el dueño del subbot puede cambiar esto 🍃' }, { quoted: msg })
        return
      }
      const { key, label } = subbotOpts[option]
      await updateSubbotSettings(subbotNumero, { [key]: true })
      await sock.sendMessage(from, { text: `> 🍃 *${label}* activado 🟢` }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '> Opción no válida 🍃' }, { quoted: msg })
  }
}