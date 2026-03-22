import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pluginsDir = path.join(__dirname, '../plugins')

let pluginWatcher = null
let reloadCallback = null
let timeout = null

export function watchPlugins(callback) {
  if (pluginWatcher) return
  
  reloadCallback = callback
  
  // Observar cambios en la carpeta plugins
  pluginWatcher = fs.watch(pluginsDir, { recursive: true }, (eventType, filename) => {
    if (filename && (eventType === 'change' || eventType === 'rename')) {
      // Usar timeout para evitar múltiples recargas por un mismo cambio
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        console.log(`🔄 Plugin cambiado: ${filename}`)
        if (reloadCallback) reloadCallback()
      }, 100)
    }
  })
}