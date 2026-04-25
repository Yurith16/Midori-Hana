import { getGroupConfig } from '../../database/db.js'
import { getSubbotGroupConfig } from '../../database/db-subbot.js'
import { getRealJid, cleanNumber } from '../../utils/jid.js'

// Caché para metadata de grupos (evita rate-limit)
const groupMetadataCache = new Map()

async function getGroupMetadataWithCache(sock, groupId, force = false) {
  const now = Date.now()
  const cached = groupMetadataCache.get(groupId)
  
  // Si hay caché y no ha pasado 1 minuto, usarlo
  if (!force && cached && (now - cached.timestamp) < 60000) {
    return cached.data
  }
  
  try {
    const metadata = await sock.groupMetadata(groupId)
    groupMetadataCache.set(groupId, {
      data: metadata,
      timestamp: now
    })
    return metadata
  } catch (err) {
    if (cached?.data) return cached.data
    throw err
  }
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

function medalla(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `${i + 1}.`
}

export default {
  command: ['contador', 'actividad', 'top'],
  group: true,
  owner: false,

  async execute(sock, msg, { from, isOwner, subbotNumero }) {
    const sender = msg.key.participant || msg.key.remoteJid
    
    // Pequeño delay para evitar rate-limit
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Usar caché para metadata
    const metadata = await getGroupMetadataWithCache(sock, from)
    
    const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                     metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

    if (!isAdmin && !isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })

    try {
      let activity = {}

      // Si es subbot, usar su base de datos
      if (subbotNumero) {
        const subbotGroupCfg = await getSubbotGroupConfig(subbotNumero, from)
        activity = subbotGroupCfg?.activity || {}
      } else {
        // Si es bot principal, usar base de datos principal
        const groupData = getGroupConfig(from)
        activity = groupData?.activity || {}
      }

      const botId    = cleanNumber(sock.user.id)
      const div      = `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`

      const conConteo = []
      for (const p of metadata.participants) {
        try {
          const realJid = await getRealJid(sock, p.id, { key: { remoteJid: from } })
          const num     = cleanNumber(realJid)
          if (!num || num === botId) continue
          const count = activity[num]?.count || 0
          conConteo.push({
            id:      realJid,
            numero:  num,
            isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
            count
          })
        } catch {
          const num = cleanNumber(p.id)
          if (!num || num === botId) continue
          const count = activity[num]?.count || 0
          conConteo.push({
            id:      p.id,
            numero:  num,
            isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
            count
          })
        }
        // Pequeño delay entre cada fetch para evitar rate-limit
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const admins        = conConteo.filter(p => p.isAdmin).sort((a, b) => b.count - a.count)
      const miembros      = conConteo.filter(p => !p.isAdmin).sort((a, b) => b.count - a.count)
      const totalMensajes = conConteo.reduce((acc, p) => acc + p.count, 0)
      const mentions      = conConteo.map(p => p.id)

      let txt = `╭─〔 🌸 *${toMono('ACTIVIDAD')}* 🌸 〕\n`
      txt += `│\n`
      txt += `│ ${toBold('Grupo:')} ${metadata.subject}\n`
      txt += `│ ${toBold('Miembros:')} ${conConteo.length}\n`
      txt += `│ ${toBold('Total msgs:')} ${totalMensajes}\n`
      if (subbotNumero) txt += `│ ${toBold('Subbot:')} +${subbotNumero}\n`

      if (admins.length > 0) {
        txt += `│ ${div}\n`
        txt += `│ ${toBold('Administradores')}\n`
        txt += `│ ${div}\n`
        admins.forEach((p, i) => {
          txt += `│ ${medalla(i)} 🌱 @${p.numero} — ${p.count} msgs\n`
        })
      }

      if (miembros.length > 0) {
        txt += `│ ${div}\n`
        txt += `│ ${toBold('Miembros')}\n`
        txt += `│ ${div}\n`
        miembros.forEach((p, i) => {
          txt += `│ ${medalla(i)} @${p.numero} — ${p.count} msgs\n`
        })
      }

      txt += `│\n`
      txt += `╰─── *${toMono('Midori-Hana')} ™* 🌸`

      await sock.sendMessage(from, { text: txt, mentions }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> Error al obtener la actividad 🍃' }, { quoted: msg })
    }
  }
}