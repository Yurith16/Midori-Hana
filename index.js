import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  generateWAMessageFromContent,
  generateWAMessage
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'
import readline from 'readline'
import { parsePhoneNumber } from 'awesome-phonenumber'
import fs from 'fs'
import { getRealJid, cleanNumber } from './utils/jid.js'
import config from './config.js'
global.config = config
import handler from './handler.js'
import { startAutoBio } from './utils/autobio.js'
import { cleanupPuppeteerCache } from './utils/cleanup.js'
import { getGroupConfig } from './database/db.js'
import { reconnectSavedSessions } from './subbot.js'
global.handler = handler
import { 
  logConnection, 
  logError, 
  logBanner, 
  logSeparator,
  logSystem 
} from './utils/logger.js'

logBanner(config.botName, '2.0.0')
logSeparator()
cleanupPuppeteerCache()

const store = {
  messages: new Map(),
  maxPerChat: 20,
  bind(ev) {
    ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        if (!msg.key?.id) continue
        const jid = msg.key.remoteJid
        if (!store.messages.has(jid)) store.messages.set(jid, new Map())
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

function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

function formatPhoneNumber(num) {
  const pn = parsePhoneNumber(num)
  if (pn.valid) return pn.number
  return num
}

const hasSession = fs.existsSync(`./${config.sessionName}/creds.json`)

async function startBot() {
  logConnection('connecting', 'Iniciando sesión...')

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionName)
  const { version }          = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger:              pino({ level: 'silent' }),
    printQRInTerminal:   false,
    browser:             Browsers.ubuntu('Chrome'),
    auth:                state,
    syncFullHistory:     false,
    downloadHistory:     false,
    markOnlineOnConnect: true,
    getMessage:          async () => undefined
  })

  sock.generateWAMessageFromContent = generateWAMessageFromContent
  sock.generateWAMessage             = generateWAMessage

  store.bind(sock.ev)

  // Bienvenidas
  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update
    if (action !== 'add') return
    try {
      const cfg = getGroupConfig(id)
      if (!cfg.welcomeMessage) return
      for (const p of participants) {
        let participantId = typeof p === 'string' ? p : (p.id || p.jid || p)
        let realJid = participantId
        try { realJid = await getRealJid(sock, participantId, { key: { remoteJid: id } }) } catch {}
        let phoneNumber = cleanNumber(realJid)
        const plantilla = cfg.welcomeText || config.welcomeText
        const mensaje   = plantilla.replace('@user', `@${participantId.split('@')[0]}`)
        await sock.sendMessage(id, { text: mensaje, mentions: [participantId] })
      }
    } catch {}
  })

  // Pairing code — solo si no hay sesión y no usa QR
  if (!hasSession && !config.useQR) {
    let numero = config.botNumber
    if (numero) {
      console.log(`Número en config: ${numero}`)
      const usar = await askQuestion('Usar este número? (s/n): ')
      if (usar.toLowerCase() !== 's' && usar.toLowerCase() !== 'si') {
        numero = await askQuestion('Ingresa tu número: ')
      }
    } else {
      numero = await askQuestion('Ingresa tu número: ')
    }
    const numeroLimpio = formatPhoneNumber(numero).replace(/\D/g, '')
    console.log(`Solicitando código para ${numeroLimpio}...`)
    try {
      const code = await sock.requestPairingCode(numeroLimpio)
      console.log(`CÓDIGO: ${code.match(/.{1,4}/g)?.join('-') || code}`)
    } catch (err) {
      logError(err, 'Pairing code')
    }
  } else if (!hasSession && config.useQR) {
    logSystem('Esperando QR...', 'info')
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !hasSession && config.useQR) {
      console.log('\n')
      qrcode.generate(qr, { small: true })
      console.log('\n')
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) {
        logConnection('disconnected', 'Reconectando...')
        setTimeout(startBot, 3000)
      } else {
        logSystem('Sesión cerrada', 'error')
      }
    } else if (connection === 'open') {
      logConnection('connected', `${sock.user.id.split(':')[0]}`)
      logSystem(`${config.botName} | Prefix: ${config.prefix}`, 'info')
      logSeparator()
      handler.initializeAntiCall(sock)
      startAutoBio(sock)

      // Reconectar subbots guardados
      if (config.subbot) {
        reconnectSavedSessions(
          (num) => logSystem(`Subbot ${num} reconectado`, 'info'),
          (num, reason) => logSystem(`Subbot ${num} desconectado (${reason})`, 'error')
        )
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue
      const from = msg.key.remoteJid
      if (!from || from.includes('@broadcast') || from.includes('status.broadcast')) continue
      const now     = Date.now() / 1000
      const msgTime = msg.messageTimestamp || 0
      if (now - msgTime > 10) continue
      const msgId = msg.key.id
      if (processedMessages.has(msgId)) continue
      processedMessages.add(msgId)
      // Paralelo directo — sin await
      handler.handleMessage(sock, msg, store).catch(() => {})
    }
  })

  return sock
}

startBot().catch(err => {
  logError(err, 'Iniciando bot')
  process.exit(1)
})