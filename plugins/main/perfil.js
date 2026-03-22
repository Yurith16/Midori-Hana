import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser } from '../../database/db.js'

export default {
  command: ['profile', 'perfil', 'my'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, sender }) {
    const userId = msg.key.participant || from
    const realJid = await getRealJid(sock, userId, msg)
    const realNumber = cleanNumber(realJid)
    
    const user = getUser(realNumber)
    
    if (!user.name || !user.age) {
      await sock.sendMessage(from, { 
        text: `> 📝 No estás registrado\n\n> Usa: .register <nombre> <edad>` 
      }, { quoted: msg })
      return
    }
    
    const fechaRegistro = new Date(user.registeredAt).toLocaleDateString('es-HN')
    
    const perfil = `> 👤 *PERFIL DE USUARIO*\n\n` +
      `> 🆔 Número: ${realNumber}\n` +
      `> 📛 Nombre: ${user.name}\n` +
      `> 🎂 Edad: ${user.age} años\n` +
      `> 📅 Registrado: ${fechaRegistro}\n` +
      `> ⭐ Nivel: ${user.level || 1}\n` +
      `> ✨ Experiencia: ${user.exp || 0}\n\n` +
      `> 🍃 Gracias por usar el bot`
    
    await sock.sendMessage(from, { text: perfil }, { quoted: msg })
  }
}