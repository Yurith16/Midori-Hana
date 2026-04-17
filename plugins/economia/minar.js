import { getRealJid } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['minar', 'mine'],
    execute: async (sock, msg, { from, sender }) => {
        try {
            const realJid = await getRealJid(sock, sender, msg)
            const user = getUser(realJid)

            if (!user?.name) {
                return sock.sendMessage(from, { 
                    text: `🌸 Cariño, no te encuentro en mi lista. Regístrate con .reg nombre edad 🍃` 
                }, { quoted: msg })
            }

            const now = Date.now()
            const cooldown = 10 * 60 * 1000
            
            if (now - (user.workLast || 0) < cooldown) {
                const rem = cooldown - (now - user.workLast)
                const min = Math.floor(rem / 60000)
                const sec = Math.floor((rem % 60000) / 1000)
                return sock.sendMessage(from, { 
                    text: `⏳ Tus manos aún tiemblan por el esfuerzo, *${user.name}*. Descansa *${min}m ${sec}s* más... 🌸` 
                }, { quoted: msg })
            }

            const minado = Math.floor(Math.random() * 200) + 50
            const exp = Math.floor(Math.random() * 25) + 10

            await updateUser(realJid, {
                kryons: (user.kryons || 0) + minado,
                exp: (user.exp || 0) + exp,
                workLast: now
            })

            await sock.sendMessage(from, { react: { text: '⛏️', key: msg.key } })
            await sock.sendMessage(from, { 
                text: `⛏️ *${user.name}* encontró una veta preciosa: obtuvo *${minado}* ${config.kryons} y *${exp}* ${config.exp}. 🌸🍃` 
            }, { quoted: msg })

        } catch (e) {
            await sock.sendMessage(from, { text: `❌ El túnel se derrumbó... intenta luego. 🍃` }, { quoted: msg })
        }
    }
}