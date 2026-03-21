export default {
  command: ['mynumber', 'miid'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, sender }) {
    const cleanId = sender.split('@')[0]
    await sock.sendMessage(from, { 
      text: `📱 Tu ID: ${cleanId}\n\nSi eres owner, agrega este ID a ownerNumbers en config.js:\n"${cleanId}"` 
    }, { quoted: msg })
  }
}