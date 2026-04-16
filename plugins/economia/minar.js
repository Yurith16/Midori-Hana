import { getUser, updateUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['minar', 'mine'],
    group: false,
    owner: false,

    async execute(sock, msg, { from, sender }) {
        try {
            const user = getUser(sender)
            
            // Validar registro
            if (!user || !user.name) {
                return sock.sendMessage(from, { 
                    text: `> ⚠️ *Acceso Denegado*\n\n> Debes registrarte primero para poder usar el sistema de minería.\n> Usa: *${config.prefix}reg nombre edad* 🍃` 
                }, { quoted: msg })
            }

            const now = Date.now()
            const cooldown = 10 * 60 * 1000 // 10 minutos
            
            // Verificación de Cooldown
            if (now - user.workLast < cooldown) {
                const remaining = cooldown - (now - user.workLast)
                const minutes = Math.floor(remaining / 60000)
                const seconds = Math.floor((remaining % 60000) / 1000)
                
                return sock.sendMessage(from, { 
                    text: `> ⏳ Espera *${minutes}m ${seconds}s* antes de volver a minar. 🍃` 
                }, { quoted: msg })
            }

            // Lógica de minado variable
            const cantidadMinada = Math.floor(Math.random() * (250 - 50 + 1)) + 50
            const expGanada = Math.floor(Math.random() * 30) + 10

            // Actualizar base de datos
            await updateUser(sender, {
                kryons: user.kryons + cantidadMinada,
                exp: user.exp + expGanada,
                workLast: now
            })

            // Diseño final solicitado
            const txt = `> 👤 *${user.name}* (${user.age} años)\n\n` +
                        `> Ohh!! *${user.name}*, has minado *${cantidadMinada}* ${config.kryons} ${config.emojiKryons} y *${expGanada}* de ${config.exp} ${config.emojiExp}.`

            await sock.sendMessage(from, { react: { text: '⛏️', key: msg.key } })
            await sock.sendMessage(from, { text: txt }, { quoted: msg })

        } catch (error) {
            console.error('Error en el comando minar:', error)
            await sock.sendMessage(from, { text: '> ❌ Error en la base de datos de Midori. 🍃' }, { quoted: msg })
        }
    }
}