import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'

export default {
  command: ['update', 'actualizar'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, sender }) {
    const userId = msg.key.participant || from
    const realJid = await getRealJid(sock, userId, msg)
    const realNumber = cleanNumber(realJid)
    
    const user = getUser(realNumber)
    
    if (!user.name || !user.age) {
      await sock.sendMessage(from, { 
        text: `> 📝 No estás registrado\n\n> Primero regístrate con: .register <nombre> <edad>` 
      }, { quoted: msg })
      return
    }
    
    if (!args[0]) {
      await sock.sendMessage(from, { 
        text: `> ¿Qué datos deseas actualizar? 🍃\n\n> *Datos actuales:*\n> 👤 Nombre: ${user.name}\n> 🎂 Edad: ${user.age} años\n\n> Ejemplo: .update Juan 30` 
      }, { quoted: msg })
      return
    }
    
    const name = args[0]
    const age = parseInt(args[1])
    
    if (!name || !age || isNaN(age) || age < 1 || age > 120) {
      await sock.sendMessage(from, { 
        text: `> ❌ Formato incorrecto\n\n> Usa: .update <nombre> <edad>\n> Ejemplo: .update Juan 30` 
      }, { quoted: msg })
      return
    }
    
    await updateUser(realNumber, { name, age })
    
    await sock.sendMessage(from, { 
      text: `> ✅ *Datos actualizados*\n\n> 👤 Nombre: ${name}\n> 🎂 Edad: ${age} años` 
    }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}