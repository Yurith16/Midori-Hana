import { getRealJid } from '../../utils/jid.js'
import { getUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['balance', 'bal', 'dinero'],
    execute: async (sock, msg, { from, sender }) => {
        try {
            const realJid = await getRealJid(sock, sender, msg)
            const user = getUser(realJid)

            if (!user?.name) {
                return sock.sendMessage(from, { 
                    text: `🌸 Regístrate primero con .register nombre edad 🍃` 
                }, { quoted: msg })
            }

            const kryons = user.kryons.toLocaleString()
            const jade = user.jade.toLocaleString()
            const exp = user.exp.toLocaleString()

            const txt = `> 🌸 Este es tu balance, *${user.name}*. Sigue así. 🍃\n` +
                        `> 💎 *${config.kryons}:* ${kryons}\n` +
                        `> 💎 *${config.jade}:* ${jade}\n` +
                        `> ✨ *${config.exp}:* ${exp}\n` +
                        `> ⭐ *Nivel:* ${user.level}`

            await sock.sendMessage(from, { react: { text: '💰', key: msg.key } })
            await sock.sendMessage(from, { text: txt }, { quoted: msg })

        } catch (e) {
            await sock.sendMessage(from, { text: `> ❌ Error. 🍃` }, { quoted: msg })
        }
    }
}