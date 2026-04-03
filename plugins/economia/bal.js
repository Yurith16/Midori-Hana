import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser } from '../../database/db.js'
import cfg from '../../config.js'

export default {
    command: ['balance', 'bal', 'dinero'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: '> 🍃 necesitas estar en mi base de datos para usar estos comandos.' }, { quoted: msg })
        }
        
        const txt = `> 👤 *${user.name}* (${user.age} años)\n\n` +
                    `> ${cfg.emojiKryons} *Kryons:* ${user.kryons}\n` +
                    `> ${cfg.emojiJade} *Jade:* ${user.jade}\n` +
                    `> ${cfg.emojiExp} *EXP:* ${user.exp}\n` +
                    `> ⭐ *Nivel:* ${user.level}`
        
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
    }
}