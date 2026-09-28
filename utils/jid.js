import { jidNormalizedUser } from '@itsmelody/baileys'

export async function getRealJid(sock, jid, m) {
  let target = jid || (m?.key?.participant || m?.key?.remoteJid || m?.participant || sock.user.id)

  if (!target.endsWith('@lid')) return jidNormalizedUser(target)

  const sender = m?.key?.participant || m?.key?.remoteJid || m?.participant

  if (target === sender) {
    if (m?.key?.remoteJidAlt?.includes('@s.whatsapp.net'))
      return jidNormalizedUser(m.key.remoteJidAlt)
    if (m?.key?.participantAlt?.includes('@s.whatsapp.net'))
      return jidNormalizedUser(m.key.participantAlt)
  }

  const chatId = m?.key?.remoteJid || m?.chat
  if (chatId?.endsWith('@g.us')) {
    try {
      const metadata    = await sock.groupMetadata(chatId)
      const participant = (metadata?.participants || []).find(p => p.id === target)
      if (participant?.phoneNumber) {
        const num = participant.phoneNumber
        return jidNormalizedUser(num.includes('@') ? num : `${num}@s.whatsapp.net`)
      }
    } catch {}
  }

  return jidNormalizedUser(target)
}

export function cleanNumber(jid) {
  if (!jid) return ''
  return String(jid).replace(/@.*$/, '').replace(/\D/g, '')
}

// ─── Resolución rápida desde caché — sin red, para eventos que solo necesitan
//     mostrar un número (quién promovió/degradó, quién cambió el nombre, etc.) ──

export function resolveNum(pid, lidCache) {
  if (pid.endsWith('@s.whatsapp.net')) return cleanNumber(pid)
  if (pid.endsWith('@lid')) {
    const cached = lidCache?.get(pid) || global.lidCache?.get(pid)
    if (cached) return cleanNumber(cached)
  }
  return cleanNumber(pid)
}