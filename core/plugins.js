import fs   from 'fs'
import path from 'path'
import { logger } from '../utils/helpers.js'

export const commands = new Map()
export const messageListeners = []

async function scan(dir, hot = false) {
  if (!fs.existsSync(dir)) return
  for (const file of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, file.name)
    if (file.isDirectory()) { await scan(full, hot); continue }
    if (!file.name.endsWith('.js')) continue
    try {
      const url = hot ? `file://${full}?t=${Date.now()}` : `file://${full}`
      const mod = await import(url)
      const raw = mod.default

      // Soporta export default [...] o export default {...}
      const cmds = Array.isArray(raw) ? raw : [raw]

      for (const cmd of cmds) {
        if (!cmd?.command) continue
        const names = Array.isArray(cmd.command) ? cmd.command : [cmd.command]
        names.forEach(n => commands.set(n, cmd))
        if (cmd.onMessage) messageListeners.push(cmd)
      }
    } catch (err) {
      logger.error('Plugin', `${file.name} — ${err.message}`)
    }
  }
}

export async function loadPlugins(hot = false) {
  commands.clear()
  messageListeners.length = 0
  await scan(path.resolve('plugins'), hot)
  if (!hot) {
    logger.info('Plugins', `${commands.size} comandos cargados`)
  }
}

export function watchPlugins() {
  const dir = path.resolve('plugins')
  if (!fs.existsSync(dir)) return
  fs.watch(dir, { recursive: true }, async (_, file) => {
    if (file?.endsWith('.js')) {
      clearTimeout(watchPlugins._timer)
      watchPlugins._timer = setTimeout(async () => {
        await loadPlugins(true)
        logger.info('Plugins', `Hot-reload — ${commands.size} comandos vigentes`)
      }, 150)
    }
  })
}