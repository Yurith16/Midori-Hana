import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import cfg from '../../config.js'

export default {
    command: ['daily', 'diario'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: '> 🍃 necesitas estar en mi base de datos para usar estos comandos.' }, { quoted: msg })
        }
        
        const tiempo = 24 * 60 * 60 * 1000
        if (Date.now() - user.dailyLast < tiempo) {
            const restante = tiempo - (Date.now() - user.dailyLast)
            const horas = Math.floor(restante / (1000 * 60 * 60))
            return sock.sendMessage(from, { text: `> ⏳ Ya reclamaste tu regalo, vuelve en *${horas}h* 🌿` }, { quoted: msg })
        }

        const premio = 500
        const nuevosKryons = user.kryons + premio
        
        // Guardar en base de datos
        await updateUser(realNumber, { 
            kryons: nuevosKryons, 
            dailyLast: Date.now() 
        })
        
        const txt = `> ${cfg.emojiKryons} haz reclamado: *${premio} ${cfg.kryons}*\n\n` +
                    `> 🍃 Vuelve mañana por más`
        
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
        await sock.sendMessage(from, { react: { text: '🎁', key: msg.key } })
    }
}