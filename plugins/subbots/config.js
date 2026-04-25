import { getSubbotGroupConfig, getSubbotSettings } from '../../database/db-subbot.js'

export default {
  command: ['sbconfig'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, config: cfg, subbotNumero }) {
    if (!subbotNumero) {
      await sock.sendMessage(from, { text: '> ❌ Este comando solo funciona en subbots.' }, { quoted: msg })
      return
    }

    const metadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null

    const groupCfg   = metadata ? await getSubbotGroupConfig(subbotNumero, from) : {}
    const sbSettings = await getSubbotSettings(subbotNumero)

    const botName = cfg?.botName || global.config?.botName || 'Midori-Hana'

    // Usar imagen personalizada del subbot o la por defecto
    let imageUrl = 'https://www.image2url.com/r2/default/images/1776639876334-87e327fb-c225-42d5-bf68-a594f976fb49.jpg'
    if (sbSettings.menuImage) {
      imageUrl = sbSettings.menuImage
    }

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

    let txt = `╭─〔 🌸 *${toMono(botName.toUpperCase())}* 🌸 〕\n`
    txt += `│\n`

    if (metadata) {
      txt += `│ 📌 ${toBold('Configuración del Grupo')}\n`
      txt += `│ ${div}\n`
      txt += `> │ 🔗 AntiLinks: ${groupCfg.antiLink ? '🟢 ON' : '🔴 OFF'}\n`
      txt += `> │ 👮 Modo admin: ${groupCfg.adminMode ? '🟢 ON' : '🔴 OFF'}\n`
      txt += `> │ 👋 Bienvenidas: ${groupCfg.welcomeMessage ? '🟢 ON' : '🔴 OFF'}\n`
      txt += `> │ 🔞 Contenido +18: ${groupCfg.nsfwEnabled ? '🟢 ON' : '🔴 OFF'}\n`
      txt += `> │ 🎭 Reacciones: ${groupCfg.reactionEnabled ? '🟢 ON' : '🔴 OFF'}\n`
      txt += `│\n`
    }

    txt += `│ 📌 ${toBold('Configuración del Subbot')}\n`
    txt += `│ ${div}\n`
    txt += `> │ 👁️ Auto leer: ${sbSettings.autoRead ? '🟢 ON' : '🔴 OFF'}\n`
    txt += `> │ 🧬 Auto bio: ${sbSettings.autoBio ? '🟢 ON' : '🔴 OFF'}\n`
    txt += `> │ 📵 Anti llamadas: ${sbSettings.antiCall ? '🟢 ON' : '🔴 OFF'}\n`
    txt += `> │ 🛡️ Anti spam: ${sbSettings.antiSpam ? '🟢 ON' : '🔴 OFF'}\n`
    txt += `> │ 💬 Mensajes privados: ${sbSettings.allowPrivate ? '🟢 ON' : '🔴 OFF'}\n`
    txt += `│\n`
    txt += `╰─── *${toMono(botName)} ™* 🌸`

    await sock.sendMessage(from, {
      image: { url: imageUrl },
      caption: txt
    }, { quoted: msg })
  }
}