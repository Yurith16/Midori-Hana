import config from '../config.js'

let bioInterval = null

export function startAutoBio(sock) {
  if (!config.autoBio) return
  
  const frases = [
    '🌱 Simple y funcional',
    '🍃 Código limpio',
    '🌿 Sin complicaciones',
    '🍀 Hecho con 💚',
    '🌱 Menos es más'
  ]
  
  const updateBio = async () => {
    try {
      const hora = new Date().toLocaleTimeString('es-HN', { 
        timeZone: 'America/Tegucigalpa',
        hour: '2-digit',
        minute: '2-digit'
      })
      const frase = frases[Math.floor(Math.random() * frases.length)]
      
      await sock.updateProfileStatus(`🇭🇳 ${config.botName} 🍃 | ${frase} | ${hora}`)
    } catch (err) {}
  }
  
  updateBio()
  bioInterval = setInterval(updateBio, 5 * 60 * 1000)
}

export function stopAutoBio() {
  if (bioInterval) clearInterval(bioInterval)
}