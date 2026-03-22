import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const configPath = path.join(__dirname, '../config.js')

let configWatcher = null
let listeners = []

export function watchConfig(callback) {
  if (configWatcher) return
  
  listeners.push(callback)
  
  configWatcher = fs.watch(configPath, async (eventType) => {
    if (eventType === 'change') {
      // Limpiar caché de import
      delete require.cache[require.resolve('../config.js')]
      
      // Recargar config
      const newConfig = await import(`../config.js?update=${Date.now()}`)
      Object.assign(global.config, newConfig.default)
      
      // Notificar a los listeners
      for (const cb of listeners) {
        cb(global.config)
      }
    }
  })
}

export function stopWatching() {
  if (configWatcher) {
    configWatcher.close()
    configWatcher = null
  }
}