import { jidNormalizedUser } from '@whiskeysockets/baileys'

export async function getRealJid(conn, jid, m) {
    let target = jid || (m?.key?.participant || m?.key?.remoteJid || m?.participant || conn.user.id)

    if (!target.endsWith('@lid')) return jidNormalizedUser(target)

    const sender = m?.key?.participant || m?.key?.remoteJid || m?.participant
    
    if (target === sender) {
        if (m?.key?.remoteJidAlt && m.key.remoteJidAlt.includes('@s.whatsapp.net')) {
            return jidNormalizedUser(m.key.remoteJidAlt)
        }
        if (m?.key?.participantAlt && m.key.participantAlt.includes('@s.whatsapp.net')) {
            return jidNormalizedUser(m.key.participantAlt)
        }
    }

    const chatId = m?.key?.remoteJid || m?.chat
    if (chatId?.endsWith('@g.us')) {
        try {
            const metadata = await conn.groupMetadata(chatId)
            if (metadata) {
                const participant = (metadata.participants || []).find(p => p.id === target)
                if (participant?.phoneNumber) {
                    let number = participant.phoneNumber
                    return jidNormalizedUser(number.includes('@') ? number : `${number}@s.whatsapp.net`)
                }
            }
        } catch (e) {}
    }
    
    return jidNormalizedUser(target)
}

export function cleanNumber(jid) {
    if (!jid) return ''
    return String(jid).replace(/@.*$/, '').replace(/\D/g, '')
}