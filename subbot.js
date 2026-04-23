import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  generateWAMessageFromContent,
  generateWAMessage,
  Browsers
} from '@whiskeysockets/baileys'

import pino from 'pino'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSubbotDb } from './database/db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const activeSubs = new Map() // numero -> { sock, connectedAt }

export function getActiveSubs() {
  return activeSubs
}

export function getSubbot(numero) {
  const data = activeSubs.get(numero)
  return data ? data.sock : null
}

export function getSubbotInfo(numero) {
  return activeSubs.get(numero) || null
}

export function countActive() {
  return activeSubs.size
}

export async function connectSubbot(numero, onCode, onConnect, onDisconnect) {
  const sessionDir = path.join(__dirname, 'sesiones-sb', numero)

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: true,
    getMessage: async () => undefined
  })

  sock.generateWAMessageFromContent = generateWAMessageFromContent
  sock.generateWAMessage = generateWAMessage
  sock.__numero = numero

  let pairingRequested = false

  if (!state.creds?.registered && !pairingRequested) {
    pairingRequested = true
    
    setTimeout(async () => {
      try {
        const numeroLimpio = numero.replace(/\D/g, '')
        console.log(`[SUBBOT ${numero}] Solicitando código para ${numeroLimpio}...`)
        
        const code = await sock.requestPairingCode(numeroLimpio)
        const formatted = code.match(/.{1,4}/g)?.join('-') || code
        
        console.log(`[SUBBOT ${numero}] Código: ${formatted}`)
        if (onCode) onCode(formatted)
      } catch (err) {
        console.error(`[SUBBOT ${numero}] Error pairing:`, err.message)
        if (onDisconnect) onDisconnect(numero, `pairing_error: ${err.message}`)
      }
    }, 3000)
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'open') {
      activeSubs.set(numero, {
        sock: sock,
        connectedAt: Date.now()
      })
      console.log(`[SUBBOT ${numero}] Conectado`)
      if (onConnect) onConnect(numero, sock)
    }

    if (connection === 'close') {
      activeSubs.delete(numero)

      const code = lastDisconnect?.error?.output?.statusCode
      const fatal = [DisconnectReason.loggedOut, 401, 403, 405]

      if (fatal.includes(code)) {
        console.log(`[SUBBOT ${numero}] Desconexión fatal (${code})`)
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true })
        } catch {}
        if (onDisconnect) onDisconnect(numero, code)
        return
      }

      const attempt = (sock.__retries || 0) + 1
      sock.__retries = attempt
      const wait = Math.min(60000, 3000 * Math.pow(2, Math.min(attempt, 5)))

      console.log(`[SUBBOT ${numero}] Reconectando en ${wait}ms (intento ${attempt})`)

      setTimeout(() => {
        connectSubbot(numero, null, onConnect, onDisconnect)
      }, wait)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    try {
      const { handleMessage } = await import('./handler.js')
      const subbotDb = await getSubbotDb(numero)

      for (const msg of messages) {
        if (!msg.message || !msg.key?.id) continue

        const from = msg.key.remoteJid
        if (!from || from.includes('@broadcast') || from.includes('status.broadcast')) continue

        const now = Date.now() / 1000
        const msgTime = msg.messageTimestamp || 0
        if (now - msgTime > 10) continue

        handleMessage(sock, msg, { loadMessage: async () => null }, subbotDb)
          .catch(() => {})
      }
    } catch (e) {
      console.error(`[SUBBOT ${numero}] Error mensajes:`, e.message)
    }
  })

  return sock
}

export async function disconnectSubbot(numero) {
  const data = activeSubs.get(numero)
  if (data) {
    try { data.sock.ev.removeAllListeners() } catch {}
    try { await data.sock.logout() } catch {}
    activeSubs.delete(numero)
    console.log(`[SUBBOT ${numero}] Desconectado manualmente`)
  }
}

export async function reconnectSavedSessions(onConnect, onDisconnect) {
  const dir = path.join(__dirname, 'sesiones-sb')
  if (!fs.existsSync(dir)) return

  const folders = fs.readdirSync(dir).filter(f => {
    try {
      return fs.statSync(path.join(dir, f)).isDirectory()
    } catch {
      return false
    }
  })

  console.log(`[SUBBOT] Reconectando ${folders.length} sesiones guardadas...`)

  for (const numero of folders) {
    const credsPath = path.join(dir, numero, 'creds.json')
    if (!fs.existsSync(credsPath)) continue

    try {
      const size = fs.statSync(credsPath).size
      if (size > 500) {
        console.log(`[SUBBOT] Reconectando sesión: ${numero}`)
        await connectSubbot(numero, null, onConnect, onDisconnect)
      }
    } catch {}
  }
}
