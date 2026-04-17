import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { registerUser, getUser } from '../../database/db.js'
import config from '../../config.js'

export default {
  command: ['register', 'reg'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, sender }) {
    const realJid = await getRealJid(sock, sender, msg)
    const realNumber = cleanNumber(realJid)  // ← Limpiar antes de usar
    
    const user = getUser(realNumber)
    
    if (user.name && user.age) {
      await sock.sendMessage(from, { 
        text: `> ✅ Ya estás registrado ${user.name} (${user.age} años)\n\n> 👛 Balance: ${user.kryons} ${config.emojiKryons}` 
      }, { quoted: msg })
      return
    }
    
    if (!args[0]) {
      await sock.sendMessage(from, { 
        text: `> ¿Qué datos deseas registrar? 🍃\n\n> Ejemplo: .register Juan 25` 
      }, { quoted: msg })
      return
    }
    
    const name = args[0]
    const age = parseInt(args[1])
    
    if (!name || !age || isNaN(age) || age < 1 || age > 120) {
      await sock.sendMessage(from, { 
        text: `> ❌ Formato incorrecto\n\n> Usa: .register <nombre> <edad>\n> Ejemplo: .register Juan 25` 
      }, { quoted: msg })
      return
    }
    
    await registerUser(realNumber, name, age)
    
    const newUser = getUser(realNumber)
    
    await sock.sendMessage(from, { 
      text: `> ✅ *Registro completado*\n\n> 👤 Nombre: ${name}\n> 🎂 Edad: ${age} años\n> 👛 Balance: ${newUser.kryons} ${config.emojiKryons}\n\n> 🍃 Bienvenido a ${config.botName}` 
    }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}