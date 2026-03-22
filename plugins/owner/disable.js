import { getGroupConfig, updateGroupConfig } from '../../database/db.js'

export default {
  command: ['disable'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const option = args[0]?.toLowerCase()
    const cfg = getGroupConfig(from)
    
    if (!option) {
      let menu = `> 🍃 *CONFIGURACIÓN DEL GRUPO*\n\n`
      menu += `> 🔗 AntiLinks: ${cfg.antiLink ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}\n`
      menu += `> 👮 Modo admin: ${cfg.adminMode ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}\n`
      menu += `> 👋 Bienvenidas: ${cfg.welcomeMessage ? '🟢 ACTIVADO' : '🔴 DESACTIVADO'}\n\n`
      menu += `> .disable antilink\n> .disable adminmode\n> .disable welcome`
      await sock.sendMessage(from, { text: menu }, { quoted: msg })
      return
    }
    
    const opts = { antilink: 'antiLink', adminmode: 'adminMode', welcome: 'welcomeMessage' }
    if (!opts[option]) return await sock.sendMessage(from, { text: '❌ Opción no válida' }, { quoted: msg })
    
    await updateGroupConfig(from, { [opts[option]]: false })
    const nombres = { antiLink: 'AntiLinks', adminMode: 'Modo admin', welcomeMessage: 'Bienvenidas' }
    await sock.sendMessage(from, { text: `> 🍃 *${nombres[opts[option]]}* desactivada 🔴` }, { quoted: msg })
  }
}