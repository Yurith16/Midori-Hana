import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import cfg from '../../config.js'

const COOLDOWN = 60 * 60 * 1000 // 1 hora
const TASA_EXITO = 0.5 // 50% de éxito para que sea más justo

export default {
    command: ['rob', 'robar'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: `> 🍃 necesitas estar registrado para usar este comando.` }, { quoted: msg })
        }
        
        // 1. Obtener JID del objetivo (mencionado o por respuesta)
        const citado = msg.message?.extendedTextMessage?.contextInfo?.participant
        const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        const targetJid = mencionado || citado

        if (!targetJid) {
            return sock.sendMessage(from, { text: `> 🍃 Menciona a alguien o responde a su mensaje para robarle.` }, { quoted: msg })
        }
        
        const targetNumber = cleanNumber(await getRealJid(sock, targetJid, msg))
        
        // 2. Validaciones de seguridad
        if (targetNumber === realNumber) {
            return sock.sendMessage(from, { text: `> 🍃 No seas bárbaro, no puedes robarte a ti mismo.` }, { quoted: msg })
        }

        const target = getUser(targetNumber)
        if (!target.name) {
            return sock.sendMessage(from, { text: `> 🍃 Esa persona no está registrada en mi base de datos.` }, { quoted: msg })
        }
        
        // 3. Verificación de tiempo (Cooldown)
        if (Date.now() - user.robLast < COOLDOWN) {
            const restante = COOLDOWN - (Date.now() - user.robLast)
            const minutos = Math.ceil(restante / (1000 * 60))
            return sock.sendMessage(from, { text: `> ⏳ La policía te busca, espera *${minutos} minutos* para volver a robar 🌿` }, { quoted: msg })
        }
        
        // 4. Lógica del Robo
        const exito = Math.random() < TASA_EXITO
        
        if (exito) {
            // Robo exitoso: 15% al 25% de los Kryons de la víctima
            const porcentaje = (Math.random() * (0.25 - 0.15) + 0.15)
            const cantidad = Math.floor(target.kryons * porcentaje)
            
            if (cantidad < 1 || target.kryons < 50) {
                return sock.sendMessage(from, { text: `> 🍃 ${target.name} está más pobre que tú, no vale la pena robarle.` }, { quoted: msg })
            }
            
            user.kryons += cantidad
            target.kryons -= cantidad
            user.robLast = Date.now()
            
            await updateUser(realNumber, { kryons: user.kryons, robLast: user.robLast })
            await updateUser(targetNumber, { kryons: target.kryons })
            
            await sock.sendMessage(from, { react: { text: '🥷', key: msg.key } })
            await sock.sendMessage(from, { text: `> ✅ ¡Éxito! Le robaste *${cantidad} ${cfg.kryons}* a ${target.name} 💸` }, { quoted: msg })
        } else {
            // Robo fallido: Multa del 10% de tus propios Kryons
            const multa = Math.floor(user.kryons * 0.10)
            user.kryons -= multa
            user.robLast = Date.now()
            
            await updateUser(realNumber, { kryons: user.kryons, robLast: user.robLast })
            
            await sock.sendMessage(from, { react: { text: '👮‍♂️', key: msg.key } })
            await sock.sendMessage(from, { text: `> ❌ ¡Te atraparon! Intentaste robar a ${target.name} y pagaste una multa de *${multa} ${cfg.kryons}*` }, { quoted: msg })
        }
    }
}