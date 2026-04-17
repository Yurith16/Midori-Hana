import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['perfil', 'me', 'profile'],
    group: false,
    owner: false,

    async execute(sock, msg, { from, sender }) {
        try {
            const realJid = await getRealJid(sock, sender, msg)
            const realNumber = cleanNumber(realJid)
            const user = getUser(realNumber)

            if (!user?.name) {
                return sock.sendMessage(from, { 
                    text: `> 🌸 *${config.botName}*\n> Regístrate primero con .register nombre edad 🍃` 
                }, { quoted: msg })
            }

            const fechaRegistro = new Date(user.registeredAt).toLocaleDateString('es-HN')
            
            const perfil = `> 🌸 *${user.name}* (${user.age} años) 🌸\n\n` +
                           `> 📅 Registrado: ${fechaRegistro}\n` +
                           `> ⭐ Nivel: ${user.level}\n` +
                           `> ✨ EXP: ${user.exp}\n\n` +
                           `> 🍃 *${config.botName}*`

            let pp = null
            try {
                pp = await sock.profilePictureUrl(sender, 'image')
            } catch (err) {
                // Sin foto, no hacemos nada
            }

            if (pp) {
                await sock.sendMessage(from, {
                    image: { url: pp },
                    caption: perfil
                }, { quoted: msg })
            } else {
                await sock.sendMessage(from, { text: perfil }, { quoted: msg })
            }

        } catch (error) {
            console.error('Error en perfil:', error)
            await sock.sendMessage(from, { text: `> ❌ Error al cargar perfil. 🍃` }, { quoted: msg })
        }
    }
}