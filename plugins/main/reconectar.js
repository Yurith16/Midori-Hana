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
            const metadata = await sock.groupMetadata(chatId)
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
  command: ['reconectar', 'reconnectsb', 'rsb'],
  execute: async (sock, msg, { from, config }) => {
    if (!config?.subbot) {
      await sock.sendMessage(from, { text: '> ❌ Sistema de subbots desactivado.' }, { quoted: msg })
      return
    }

    const realJid = await getRealJid(sock, null, msg)
    const numero = cleanNumber(realJid)

    const sessionPath = path.join(SESSIONS_DIR, numero)
    const credsPath = path.join(sessionPath, 'creds.json')

    if (!fs.existsSync(sessionPath) || !fs.existsSync(credsPath)) {
      await sock.sendMessage(from, { text: `> ❌ Hola, no tienes una sesión activa *${numero}*\n> 🍃 Usa .code para vincular tu número.` }, { quoted: msg })
      return
    }

    // Verificar si la sesión no está corrupta
    try {
      const stats = fs.statSync(credsPath)
      if (stats.size < 100) {
        await sock.sendMessage(from, { text: `> ⚠️ Tu sesión *${numero}* está corrupta.\n> 🍃 Elimínala con .delsb y vuelve a vincular con .code` }, { quoted: msg })
        return
      }
    } catch (err) {
      await sock.sendMessage(from, { text: `> ❌ Error al verificar tu sesión: ${err.message}` }, { quoted: msg })
      return
    }

    // Verificar si ya está conectado
    const { getActiveSubs, connectSubbot } = await import('../../subbot.js')
    const activeSub = getActiveSubs().get(numero)
    
    if (activeSub) {
      await sock.sendMessage(from, { text: `> ✅ Ya estás conectado *${numero}*` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return
    }

    await sock.sendMessage(from, { react: { text: '🔄', key: msg.key } })
    await sock.sendMessage(from, { text: `> 🔄 Reconectando sesión *${numero}*...` }, { quoted: msg })

    try {
      await connectSubbot(
        numero,
        null, // No necesita código porque ya tiene sesión
        async (num) => {
          await sock.sendMessage(from, { text: `> ✅ Subbot *${num}* reconectado exitosamente.` }, { quoted: msg })
          await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
        },
        async (num, reason) => {
          await sock.sendMessage(from, { text: `> ❌ Error al reconectar: ${reason}` }, { quoted: msg })
          await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        }
      )
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { text: `> ❌ Error: ${err.message}` }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}