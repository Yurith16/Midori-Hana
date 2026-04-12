import chalk from 'chalk'
import { cleanNumber } from './jid.js'

// ─── PALETA KARI ───────────────────────────────────────────
const k = {
  verde:    chalk.hex('#00FF7F').bold,
  amarillo: chalk.hex('#FFD700').bold,
  rojo:     chalk.hex('#FF3333').bold,
  rosa:     chalk.hex('#FF69B4').bold,
  azul:     chalk.hex('#00BFFF').bold,
  blanco:   chalk.white.bold,
  gris:     chalk.hex('#AAAAAA'),
  borde:    chalk.hex('#444444'),
}

const LINE = 50

function time() {
  return new Date().toLocaleTimeString('es-HN', {
    timeZone: 'America/Tegucigalpa',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

function header(label, color) {
  const inner = `┌─[ ${label} • ${time()} ]`
  const clean = stripAnsi(inner)
  const pad = '─'.repeat(Math.max(0, LINE - clean.length))
  return color(inner) + color(pad)
}

function headerNoTime(label, color) {
  const inner = `┌─[ ${label} ]`
  const clean = stripAnsi(inner)
  const pad = '─'.repeat(Math.max(0, LINE - clean.length))
  return color(inner) + color(pad)
}

function footer(color) {
  return color('└' + '─'.repeat(LINE))
}

function row(content) {
  return k.borde('│ ') + content
}

function formatNumber(sender) {
  const num = cleanNumber(sender)
  if (num.length < 8) return k.gris(sender.split('@')[0])
  return k.azul('+' + num)
}

// ─── EXPORTS ───────────────────────────────────────────────

export function logCommand({ command, sender, userName, isOwner, isGroup, groupName, args, prefix }) {
  const name     = k.blanco(userName || sender.split('@')[0])
  const number   = formatNumber(sender)
  const argsText = args?.length ? k.gris(' → ' + args.join(' ').slice(0, 40)) : ''
  const icon     = isOwner ? '👑' : isGroup ? '👥' : '🌸'
  const color    = isOwner ? k.amarillo : k.verde

  // Línea 1 — nombre del grupo o PRIVADO
  const label = isGroup ? (groupName || 'Grupo') : 'PRIVADO'
  console.log(header(label, color))

  // Línea 2 — ID del grupo o chat privado
  const locationId = isGroup
    ? k.gris(sender.replace(/^[^@]*@/, '@'))
    : k.gris('Chat Privado')
  console.log(row(`🆔  ${locationId}`))

  // Línea 3 — nombre y número del usuario
  console.log(row(`${icon}  ${name}  ${k.gris('•')}  ${number}`))

  // Línea 4 — comando usado
  console.log(row(`⚡  ${color(prefix + command)}${argsText}`))

  console.log(footer(color))
  console.log('')
}

export function logMessage({ sender, message, isGroup, groupName, userName }) {
  const name    = k.blanco(userName || sender.split('@')[0])
  const number  = formatNumber(sender)
  const preview = k.gris(message.length > 45 ? message.slice(0, 42) + '...' : message)
  const label   = isGroup ? (groupName || 'Grupo') : 'PRIVADO'

  console.log(header(label, k.verde))

  const locationId = isGroup
    ? k.gris(sender.replace(/^[^@]*@/, '@'))
    : k.gris('Chat Privado')
  console.log(row(`🆔  ${locationId}`))

  console.log(row(`💬  ${name}  ${k.gris('•')}  ${number}`))
  console.log(row(preview))
  console.log(footer(k.verde))
  console.log('')
}

export function logConnection(status, details = '') {
  if (status === 'connected') {
    console.log(headerNoTime('CONEXIÓN', k.verde))
    console.log(row(`✅  ${k.verde(details)}`))
    console.log(footer(k.verde))
  } else if (status === 'connecting') {
    console.log(headerNoTime('CONEXIÓN', k.amarillo))
    console.log(row(`🔄  ${k.amarillo(details)}`))
    console.log(footer(k.amarillo))
  } else if (status === 'disconnected') {
    console.log(headerNoTime('CONEXIÓN', k.rojo))
    console.log(row(`📡  ${k.rojo(details)}`))
    console.log(footer(k.rojo))
  }
  console.log('')
}

export function logError(error, context) {
  console.log(headerNoTime('ERROR', k.rojo))
  console.log(row(`🔥  ${k.rojo(context)}: ${k.blanco(error?.message || String(error))}`))
  console.log(footer(k.rojo))
  console.log('')
}

export function logEvent(event, details) {
  console.log(k.borde('│ ') + k.verde('✨ ') + k.amarillo(event) + ' ' + k.blanco(details))
}

export function logPlugin(name) {
  console.log(k.borde('│ ') + k.verde('✓ ') + k.blanco(name))
}

export function logSystem(msg, type = 'info') {
  const color = type === 'error' ? k.rojo : type === 'warning' ? k.amarillo : k.azul
  const icon  = type === 'error' ? '🔥' : type === 'warning' ? '⚠️' : '🤖'
  console.log(headerNoTime('SISTEMA', color))
  console.log(row(`${icon}  ${color(msg)}`))
  console.log(footer(color))
  console.log('')
}

export function logSeparator() {
  console.log(k.borde('─'.repeat(LINE + 1)))
}

export function logBanner(name, version) {
  console.log('')
  console.log(k.verde('  ╔══════════════════════════════════════╗'))
  console.log(k.verde('  ║  ') + k.rosa(`${name}`) + k.amarillo(` v${version}`) + k.verde('                    ║'))
  console.log(k.verde('  ║  ') + k.azul('WhatsApp Bot · Honduras 🇭🇳') + k.verde('          ║'))
  console.log(k.verde('  ╚══════════════════════════════════════╝'))
  console.log('')
}