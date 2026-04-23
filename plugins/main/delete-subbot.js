import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jidNormalizedUser } from '@whiskeysockets/baileys'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SESSIONS_DIR = path.join(__dirname, '../../sesiones-sb')

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

export default {
  command: ['delsb', 'deletesb', 'eliminarsb'],
  execute: async (sock, msg, { from, config }) => {
    if (!config?.subbot) {
      await sock.sendMessage(from, { text: '> ❌ Sistema de subbots desactivado.' }, { quoted: msg })
      return
    }

    const realJid = await getRealJid(sock, null, msg)
    const numero = cleanNumber(realJid)

    const sessionPath = path.join(SESSIONS_DIR, numero)

    if (!fs.existsSync(sessionPath)) {
      await sock.sendMessage(from, { text: `> ❌ Hola, no tienes una sesión activa *${numero}*` }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🗑️', key: msg.key } })

    try {
      const { disconnectSubbot, getActiveSubs } = await import('../../subbot.js')
      const activeSub = getActiveSubs().get(numero)
      
      if (activeSub) {
        disconnectSubbot(numero).catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      fs.rmSync(sessionPath, { recursive: true, force: true })

      await sock.sendMessage(from, { text: `> ✅ Hola, tu sesión *${numero}* ha sido eliminada.\n> 🍃 Usa .code para vincular nuevamente.` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}` }, { quoted: msg })
    }
  }
}