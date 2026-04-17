import db from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['top', 'ranking', 'leaderboard'],
    execute: async (sock, msg, { from }) => {
        try {
            const users = db.data.users
            const ranking = Object.entries(users)
                .filter(([_, data]) => data.name && data.name.trim() !== '')
                .map(([id, data]) => ({
                    name: data.name,
                    kryons: data.kryons || 0,
                    exp: data.exp || 0,
                    level: data.level || 1
                }))
                .sort((a, b) => b.kryons - a.kryons)
                .slice(0, 15)

            if (ranking.length === 0) {
                return sock.sendMessage(from, { 
                    text: `> 🌸 Aún no hay usuarios registrados. 🍃` 
                }, { quoted: msg })
            }

            let txt = `> 🌸 *TOP 15 RIQUEZA* 🌸\n\n`
            
            for (let i = 0; i < ranking.length; i++) {
                const user = ranking[i]
                const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📍'
                txt += `> ${medal} *${i + 1}.* ${user.name}\n`
                txt += `>    💎 ${user.kryons.toLocaleString()} ${config.kryons}\n`
                txt += `>    ✨ Nivel ${user.level}\n\n`
            }

            txt += `> 🍃 Sigue minando para subir en el ranking.`

            await sock.sendMessage(from, { react: { text: '🏆', key: msg.key } })
            await sock.sendMessage(from, { text: txt }, { quoted: msg })

        } catch (e) {
            console.error('Error en top:', e)
            await sock.sendMessage(from, { text: `> ❌ Error al cargar el ranking. 🍃` }, { quoted: msg })
        }
    }
}