import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion 
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import config from './config.js'
import handler from './handler.js'
import { cleanupPuppeteerCache } from './utils/cleanup.js'
import { 
  logConnection, 
  logError, 
  logBanner, 
  logSeparator,
  logSystem 
} from './utils/logger.js'

// Mostrar banner
logBanner(config.botName, '2.0.0')
logSeparator()

// Limpiar cache
cleanupPuppeteerCache()

const store = {
  messages: new Map(),
  maxPerChat: 20,

  bind(ev) {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue
        const jid = msg.key.remoteJid
        if (!store.messages.has(jid)) {
          store.messages.set(jid, new Map())
        }
        const chatMsgs = store.messages.get(jid)
        chatMsgs.set(msg.key.id, msg)

        if (chatMsgs.size > store.maxPerChat) {
          const oldestKey = chatMsgs.keys().next().value
          chatMsgs.delete(oldestKey)
        }
      }
    })
  },

  loadMessage: async (jid, id) => {
    return store.messages.get(jid)?.get(id) || null
  }
}

const processedMessages = new Set()
setInterval(() => processedMessages.clear(), 5 * 60 * 1000)

async function startBot() {
  logConnection('connecting', 'Iniciando sesión...')

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Chrome', 'Windows', '10.0'],
    auth: state,
    syncFullHistory: false,
    downloadHistory: false,
    markOnlineOnConnect: true,
    getMessage: async () => undefined
  })

  store.bind(sock.ev)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      logConnection('qr')
      console.log('\n')
      qrcode.generate(qr, { small: true })
      console.log('\n')
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        logConnection('disconnected', 'Reconectando en 3 segundos...')
        setTimeout(startBot, 3000)
      } else {
        logSystem('Sesión cerrada, elimina carpeta session y reinicia', 'error')
      }
    } else if (connection === 'open') {
      logConnection('connected', `${sock.user.id.split(':')[0]}`)
      logSystem(`${config.botName} | Prefix: ${config.prefix}`, 'info')
      logSeparator()
      handler.initializeAntiCall(sock)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue

      const from = msg.key.remoteJid
      if (!from || from.includes('@broadcast') || from.includes('status.broadcast')) continue

      const msgId = msg.key.id
      if (processedMessages.has(msgId)) continue
      processedMessages.add(msgId)

      await handler.handleMessage(sock, msg, store)
    }
  })

  return sock
}

startBot().catch(err => {
  logError(err, 'Iniciando bot')
  process.exit(1)
})