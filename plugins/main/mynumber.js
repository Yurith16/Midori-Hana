import { getRealJid, cleanNumber } from '../../utils/jid.js'

export default {
  command: ['mynumber', 'miid'],
  group: false,
  owner: false,

  async execute(sock, msg, { from, sender }) {
    try {
      const realJid = await getRealJid(sock, sender, msg)
      const cleanId = cleanNumber(realJid)

      await sock.sendMessage(from, {
        text: `> 📱 Tu número: *+${cleanId}* 🍃\n> Para usarlo como owner agrega: *"${cleanId}"*`
      }, { quoted: msg })

    } catch (err) {
      const cleanId = cleanNumber(sender)
      await sock.sendMessage(from, {
        text: `> 📱 Tu número: *+${cleanId}* 🍃`
      }, { quoted: msg })
    }
  }
}