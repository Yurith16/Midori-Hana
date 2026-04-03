import db from '../../database/db.js'
import cfg from '../../config.js'

export default {
    command: ['top', 'leaderboard', 'ranking'],
    execute: async (sock, msg, { from }) => {
        // Obtenemos todos los usuarios de la base de datos
        const usersData = db.data.users
        const userList = Object.entries(usersData)

        // Mapeamos y filtramos solo los que tienen nombre (están registrados)
        const topUsers = userList
            .map(([jid, data]) => ({ jid, ...data }))
            .filter(user => user.name) 
            // Ordenamos de mayor a menor según sus Kryons
            .sort((a, b) => b.kryons - a.kryons)
            .slice(0, 10) // Solo los 10 mejores

        if (topUsers.length === 0) {
            return sock.sendMessage(from, { text: '> 🍃 No hay usuarios registrados en el ranking todavía.' }, { quoted: msg })
        }

        let txt = `> 🏆 *TOP 10 USUARIOS MÁS RICOS*\n\n`
        
        topUsers.forEach((user, index) => {
            const medalla = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'
            txt += `> ${medalla} *${index + 1}. ${user.name}*\n`
            txt += `> 💠 ${user.kryons} ${cfg.kryons} | ⭐ Lvl: ${user.level}\n`
            txt += `> ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`
        })

        txt += `\n> 🍃 ¡Sigue activo para subir en el ranking de ${cfg.botName}!`

        await sock.sendMessage(from, { react: { text: '🏆', key: msg.key } })
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
    }
}