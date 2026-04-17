import { getRealJid } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['daily', 'diario'],
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
            const cooldown = 24 * 60 * 60 * 1000 // 24 horas
            
            if (now - (user.dailyLast || 0) < cooldown) {
                const rem = cooldown - (now - user.dailyLast)
                const hours = Math.floor(rem / 3600000)
                const minutes = Math.floor((rem % 3600000) / 60000)
                return sock.sendMessage(from, { 
                    text: `⏳ *${user.name}*, ya reclamaste tu recompensa hoy. Vuelve en *${hours}h ${minutes}m*... 🌸` 
                }, { quoted: msg })
            }

            // Recompensas aumentadas
            const kryonsBase = 1000
            const expBase = 80
            const bonus = Math.floor(Math.random() * 500) // Bonus aleatorio hasta 500
            
            const recompensa = kryonsBase + bonus
            const exp = expBase

            await updateUser(realJid, {
                kryons: (user.kryons || 0) + recompensa,
                exp: (user.exp || 0) + exp,
                dailyLast: now
            })

            await sock.sendMessage(from, { react: { text: '🎁', key: msg.key } })
            await sock.sendMessage(from, { 
                text: `🎁 *${user.name}* recibió su recompensa diaria: *${recompensa}* ${config.kryons} (bonus +${bonus}) y *${exp}* ${config.exp}. 🌸🍃` 
            }, { quoted: msg })

        } catch (e) {
            await sock.sendMessage(from, { text: `❌ No pude darte tu recompensa. Intenta luego. 🍃` }, { quoted: msg })
        }
    }
}