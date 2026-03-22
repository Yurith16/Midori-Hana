import config from '../../config.js'

export default {
  command: ['ping', 'p'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const start = Date.now()
    
    // Tiempo activo del bot
    const uptime = process.uptime()
    const horas = Math.floor(uptime / 3600)
    const minutos = Math.floor((uptime % 3600) / 60)
    const segundos = Math.floor(uptime % 60)
    
    // Hora actual de Honduras
    const ahora = new Date()
    const horaHn = ahora.toLocaleTimeString('es-HN', { 
      timeZone: 'America/Tegucigalpa',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    await sock.sendMessage(from, { text: '🏓 Calculando...' }, { quoted: msg })
    const latency = Date.now() - start
    
    const mensaje = `> 🏓 *PONG!*\n\n` +
      `> ⚡ *Latencia:* ${latency}ms\n` +
      `> 🕐 *Activo:* ${horas}h ${minutos}m ${segundos}s\n` +
      `> 🕘 *Hora HN:* ${horaHn}\n` +
      `> 🍃 *${config.botName} online*`
    
    await sock.sendMessage(from, { text: mensaje }, { quoted: msg })
  }
}