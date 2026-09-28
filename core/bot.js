import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  generateWAMessageFromContent,
  generateWAMessage
} from '@itsmelody/baileys'
import pino     from 'pino'
import readline from 'readline'
import { parsePhoneNumber } from 'awesome-phonenumber'
import fs from 'fs'
import { cleanNumber }              from '../utils/jid.js'
import { logger, startAutoBio }     from '../utils/helpers.js'
import { handleMessage }            from './pipeline.js'
import { getGroupsWithSaludos, setSaludoTimestamp } from './sqlite.js'

import { FRASES_MANANA, FRASES_TARDE, FRASES_NOCHE } from '../settings/frases.js'

const processed = new Set()
setInterval(() => processed.clear(), 5 * 60 * 1000)

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  process.stdout.write('')
  return new Promise(r => rl.question(question, a => { rl.close(); r(a.trim()) }))
}

function normalizeNumber(num) {
  const pn = parsePhoneNumber(String(num))
  let limpio = (pn.valid ? pn.number : num).replace(/\D/g, '')
  if (limpio.startsWith('52') && !limpio.startsWith('521') && limpio.length === 12) {
    limpio = '521' + limpio.slice(2)
  }
  return limpio
}

function nombreDisconnect(code) {
  const nombres = {
    [DisconnectReason.badSession]:       'badSession',
    [DisconnectReason.connectionClosed]: 'connectionClosed',
    [DisconnectReason.connectionLost]:   'connectionLost',
    [DisconnectReason.connectionReplaced]: 'connectionReplaced',
    [DisconnectReason.loggedOut]:        'loggedOut',
    [DisconnectReason.restartRequired]:  'restartRequired',
    [DisconnectReason.timedOut]:         'timedOut',
    [DisconnectReason.multideviceMismatch]: 'multideviceMismatch',
    [DisconnectReason.forbidden]:        'forbidden',
    [DisconnectReason.unavailableService]: 'unavailableService',
  }
  return nombres[code] || `desconocido (${code})`
}

function getHoraHonduras() {
  const ahora = new Date()
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000
  const hn    = new Date(utcMs - 6 * 3600000)
  return { hora: hn.getHours(), fecha: hn.toISOString().slice(0, 10), ts: Math.floor(hn.getTime() / 1000) }
}

function getFrasesYTipo() {
  const { hora } = getHoraHonduras()
  if (hora >= 6  && hora < 12) return { frases: FRASES_MANANA, tipo: 'manana' }
  if (hora >= 12 && hora < 19) return { frases: FRASES_TARDE,  tipo: 'tarde'  }
  return                              { frases: FRASES_NOCHE,   tipo: 'noche'  }
}

function yaSeMandoboy(grupo, tipo) {
  const col    = `ultimo_saludo_${tipo}`
  const ultimo = grupo[col] || 0
  if (!ultimo) return false
  const { fecha } = getHoraHonduras()
  const fechaUltimo = new Date((ultimo - 6 * 3600) * 1000).toISOString().slice(0, 10)
  return fechaUltimo === fecha
}

const ultimoIndice = { manana: -1, tarde: -1, noche: -1 }

function elegirFrase(frases, tipo) {
  let idx
  do {
    idx = Math.floor(Math.random() * frases.length)
  } while (idx === ultimoIndice[tipo] && frases.length > 1)
  ultimoIndice[tipo] = idx
  return frases[idx]
}

function startSaludosChecker(sock) {
  setInterval(async () => {
    try {
      const { frases, tipo } = getFrasesYTipo()
      const grupos           = getGroupsWithSaludos()
      if (!grupos.length) return

      for (const grupo of grupos) {
        if (yaSeMandoboy(grupo, tipo)) continue

        const frase = elegirFrase(frases, tipo)

        try {
          await sock.sendMessage(grupo.group_id, { text: frase })
          setSaludoTimestamp(grupo.group_id, tipo)
          await new Promise(r => setTimeout(r, 1500))
        } catch {}
      }
    } catch (err) {
      logger.error('Saludos', err.message)
    }
  }, 60 * 1000)

  logger.info('Saludos', 'Checker de saludos iniciado ✦')
}

let intentosReconexion = 0
const BACKOFF_BASE = 3000
const BACKOFF_MAX  = 60000

function calcularBackoff() {
  const tiempo = Math.min(BACKOFF_BASE * Math.pow(2, intentosReconexion), BACKOFF_MAX)
  intentosReconexion++
  return tiempo
}

function resetBackoff() {
  intentosReconexion = 0
}

export async function startBot() {
  const bot        = global.bot
  const sessionDir = bot.session
  const hasSession = fs.existsSync(`./${sessionDir}/creds.json`)

  logger.info('Sesión', hasSession ? 'Credenciales encontradas' : 'Sin sesión, iniciando emparejamiento...')

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
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

  if (!hasSession) {
    await new Promise(r => setTimeout(r, 1500))

    process.stdout.write(`\n`)
    const ingresado = await ask('  Ingresa el número del bot con código de país (ej: 50412345678): ')
    const numero    = normalizeNumber(ingresado)

    if (!numero || numero.length < 8) {
      logger.error('Pairing', 'Número inválido. Reiniciando...')
      setTimeout(startBot, 3000)
      return
    }

    logger.info('Pairing', `Solicitando código para ${numero}...`)
    try {
      const code = await sock.requestPairingCode(numero)
      const fmt  = code.match(/.{1,4}/g)?.join('-') || code
      process.stdout.write(`\n  🔑 Código de emparejamiento: ${fmt}\n\n`)
      process.stdout.write(`  Ingresa este código en WhatsApp:\n`)
      process.stdout.write(`  Dispositivos vinculados → Vincular dispositivo → Ingresar código\n\n`)
    } catch (err) {
      logger.error('Pairing', `Error al pedir código: ${err.message}`)
    }
  }

  const lidCache = new Map()

  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      try {
        const meta = await sock.groupMetadata(update.id)
        for (const p of meta.participants) {
          if (p.id.endsWith('@lid') && p.phoneNumber) {
            const num = cleanNumber(p.phoneNumber)
            if (num) lidCache.set(p.id, `${num}@s.whatsapp.net`)
          }
        }
      } catch {}
    }
  })

  if (global.features?.antiCall) {
    sock.ev.on('call', async (calls) => {
      for (const call of calls) {
        if (call.status !== 'offer') continue
        try {
          await sock.rejectCall(call.id, call.from)
          logger.warn('Anti-call', `Llamada rechazada de ${call.from.split('@')[0]}`)
        } catch {}
      }
    })
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code       = lastDisconnect?.error?.output?.statusCode
      const nombreCode = nombreDisconnect(code)

      logger.error('Conexión', `Desconectado — código: ${code} (${nombreCode})`)

      if (code === DisconnectReason.loggedOut) {
        logger.error('Conexión', 'Sesión cerrada por WhatsApp. Debes vincular de nuevo.')
        resetBackoff()
        return
      }

      const tiempoEspera = calcularBackoff()
      logger.warn('Conexión', `Reconectando en ${Math.round(tiempoEspera / 1000)}s... (intento ${intentosReconexion})`)
      setTimeout(startBot, tiempoEspera)
    }

    if (connection === 'open') {
      resetBackoff()
      global.connectionStartTime = Date.now()
      logger.info('Conexión', `${global.messages?.online} — ${sock.user.id.split(':')[0]}`)
      logger.info('Config', `Prefix: ${global.bot?.prefix?.join(' ')} | Grupos: activos`)

      startAutoBio(sock)
      startSaludosChecker(sock)

      setTimeout(async () => {
        try {
          const groups = await sock.groupFetchAllParticipating()
          for (const [, meta] of Object.entries(groups)) {
            for (const p of meta.participants) {
              if (!p.id.endsWith('@lid')) continue
              const num = p.phoneNumber ? cleanNumber(p.phoneNumber) : null
              if (num && num.length >= 8) {
                const jid = `${num}@s.whatsapp.net`
                lidCache.set(p.id, jid)
                if (!global.lidCache) global.lidCache = new Map()
                global.lidCache.set(p.id, jid)
              }
            }
          }
          logger.info('Caché', 'JIDs pre-cacheados ✦')
        } catch {}
      }, 3000)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || !msg.key?.id) continue
      const from = msg.key.remoteJid
      if (!from || from.includes('@broadcast') || from.includes('status')) continue
      const now = Date.now() / 1000
      if (now - (msg.messageTimestamp || 0) > 15) continue
      if (processed.has(msg.key.id)) continue
      processed.add(msg.key.id)

      if (global.features?.autoRead && !msg.key.fromMe) {
        sock.readMessages([msg.key]).catch(() => {})
      }

      handleMessage(sock, msg).catch(() => {})
    }
  })

  return sock
}