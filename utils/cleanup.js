import fs from 'fs'
import path from 'path'
import os from 'os'

export function cleanupPuppeteerCache() {
  try {
    const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer')
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
  } catch (err) {
    // Ignorar errores
  }
}