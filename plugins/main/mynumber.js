import { getRealJid, cleanNumber } from '../../utils/jid.js'

export default {
  command: ['mynumber', 'miid'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, sender }) {
    try {
      // Obtener el número real usando getRealJid
      const realJid = await getRealJid(sock, sender, msg)
      const cleanId = cleanNumber(realJid)
      
      await sock.sendMessage(from, { 
        text: `📱 Tu número real: ${cleanId}\n\nSi eres owner, agrega este número a ownerNumbers en config.js:\n"${cleanId}"` 
      }, { quoted: msg })
    } catch (err) {
      // Fallback por si algo falla
      const cleanId = sender.split('@')[0]
      await sock.sendMessage(from, { 
        text: `📱 Tu ID: ${cleanId}\n\nSi eres owner, agrega este ID a ownerNumbers en config.js:\n"${cleanId}"` 
      }, { quoted: msg })
    }
  }
}