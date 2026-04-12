import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../../config.js')

// Leer prefijos directamente del archivo para evitar problemas con global.config
function getPrefixes() {
  const content = fs.readFileSync(configPath, 'utf8')
  const match = content.match(/prefix:\s*(\[[\s\S]*?\]|'[^']*')/)
  if (!match) return ['.']
  const raw = match[1].trim()
  if (raw.startsWith('[')) {
    return raw.slice(1, -1).split(',').map(s => s.trim().replace(/'/g, ''))
  }
  return [raw.replace(/'/g, '')]
}

function savePrefixes(prefixes) {
  let content = fs.readFileSync(configPath, 'utf8')
  const value = prefixes.length === 1
    ? `'${prefixes[0]}'`
    : `[${prefixes.map(p => `'${p}'`).join(', ')}]`
  // Usar split/join en lugar de regex para evitar problemas con caracteres especiales
  const lines = content.split('\n')
  const idx = lines.findIndex(l => l.match(/^\s*prefix:/))
  if (idx !== -1) lines[idx] = lines[idx].replace(/prefix:\s*.*/, `prefix: ${value},`)
  fs.writeFileSync(configPath, lines.join('\n'), 'utf8')
}

export default {
  command: ['delprefix', 'removeprefix'],
  group: false,
  owner: true,

  async execute(sock, msg, { args, from, isOwner }) {
    if (!isOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> Solo el owner puede cambiar los prefijos 🍃' }, { quoted: msg })
      return
    }

    const objetivo = args[0]

    if (!objetivo) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Escribe el prefijo que deseas eliminar 🍃' }, { quoted: msg })
      return
    }

    const prefijos = getPrefixes()

    if (!prefijos.includes(objetivo)) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: `> El prefijo \`${objetivo}\` no existe 🍃\n> Activos: ${prefijos.map(p => `\`${p}\``).join(', ')}` }, { quoted: msg })
      return
    }

    if (prefijos.length === 1) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Debe quedar al menos un prefijo activo 🍃' }, { quoted: msg })
      return
    }

    const actualizados = prefijos.filter(p => p !== objetivo)
    savePrefixes(actualizados)

    await sock.sendMessage(from, {
      text: `> Prefijo \`${objetivo}\` eliminado 🍃\n> Activos: ${actualizados.map(p => `\`${p}\``).join(', ')}`
    }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}