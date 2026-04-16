import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { registerUser, getUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['perfil', 'me', 'profile'],
    group: false,
    owner: false,

    async execute(sock, msg, { from, sender }) {
        try {
            const userId = sender
            const user = getUser(userId)

            const perfil = `
✨ *PERFIL DE USUARIO* ✨
──────────────────
👤 *Nombre:* ${user.name || 'Sin registrar'}
🎂 *Edad:* ${user.age || '??'} años
✨ *Nivel:* ${user.level} (${user.exp} EXP)

${config.emojiKryons} *${config.kryons}:* ${user.kryons}
${config.emojiJade} *${config.jade}:* ${user.jade}
──────────────────
🌿 *${config.botName}*
`.trim()

            let pp
            try {
                // Intentamos obtener la foto de perfil del usuario
                pp = await sock.profilePictureUrl(userId, 'image')
            } catch {
                // Si no tiene foto o da error, usamos la del config
                pp = config.defaultImg
            }

            await sock.sendMessage(from, {
                image: { url: pp },
                caption: perfil,
                mentions: [userId]
            }, { quoted: msg })

        } catch (error) {
            console.error('Error en el comando perfil:', error)
        }
    }
}