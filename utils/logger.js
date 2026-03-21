import chalk from 'chalk'

const colors = {
  error: chalk.red.bold,
  success: chalk.green.bold,
  warning: chalk.yellow.bold,
  info: chalk.cyan,
  command: chalk.magenta.bold,
  group: chalk.green,
  timestamp: chalk.gray,
  owner: chalk.yellow.bold,
  user: chalk.blue
}

function getTimestamp() {
  return colors.timestamp(`[${new Date().toLocaleTimeString()}]`)
}

export function logCommand({ command, sender, userName, isOwner, isGroup, groupName, args, prefix }) {
  const timestamp = getTimestamp()
  const icon = isOwner ? '👑' : '👤'
  const name = userName || sender
  const location = isGroup ? colors.group(`[${groupName || 'Grupo'}]`) : colors.info('[Privado]')
  const cmd = colors.command(`${prefix}${command}`)
  const argsText = args?.length ? colors.info(` ${args.join(' ')}`) : ''
  const role = isOwner ? colors.owner('OWNER') : ''

  // Orden: timestamp icono nombre ubicación → comando args rol
  console.log(`${timestamp} ${icon} ${colors.user(name)} ${location} → ${cmd}${argsText} ${role}`.trim())
}

export function logConnection(status, details = '') {
  const ts = getTimestamp()
  if (status === 'connected') console.log(`${ts} ${colors.success('✅')} ${colors.success(details)}`)
  else if (status === 'connecting') console.log(`${ts} ${colors.warning('🔄')} ${details}`)
  else if (status === 'qr') console.log(`${ts} ${colors.warning('📱')} Escanea el QR`)
  else console.log(`${ts} ${colors.info('📡')} ${status}`)
}

export function logError(error, context) {
  console.log(`${getTimestamp()} ${colors.error('⚠️')} ${context}: ${colors.error(error.message || error)}`)
}

export function logPlugin(name) {
  console.log(`${getTimestamp()} ${colors.success('✓')} ${colors.command(name)}`)
}

export function logMessage({ sender, message, isGroup, groupName, userName }) {
  const timestamp = getTimestamp()
  const icon = '💬'
  const name = userName || sender.split('@')[0]
  const location = isGroup ? colors.group(`[${groupName || 'Grupo'}]`) : colors.info('[Privado]')
  const msgPreview = message.length > 50 ? message.slice(0, 47) + '...' : message

  console.log(`${timestamp} ${icon} ${colors.user(name)} ${location} → ${colors.info(msgPreview)}`)
}

export function logEvent(event, details) {
  console.log(`${getTimestamp()} ${colors.success('✨')} ${colors.command(event)} ${colors.info(details)}`)
}

export function logSystem(msg, type = 'info') {
  const icon = type === 'error' ? '🔥' : type === 'warning' ? '⚠️' : '🤖'
  const color = type === 'error' ? colors.error : type === 'warning' ? colors.warning : colors.info
  console.log(`${getTimestamp()} ${color(icon)} ${color(msg)}`)
}

export function logSeparator() {
  console.log(colors.timestamp('─'.repeat(60)))
}

export function logBanner(name, version) {
  console.log(colors.success(`
╔══════════════════════════════════════════════════╗
║  ${colors.command(name)} v${version}                                   
║  ${colors.info('WhatsApp Bot')}                          
╚══════════════════════════════════════════════════╝
`))
}