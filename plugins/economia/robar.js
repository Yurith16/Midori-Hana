import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import cfg from '../../config.js'

const COOLDOWN = 60 * 60 * 1000 // 1 hora
const TASA_EXITO = 0.5

export default {
    command: ['rob', 'robar'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: `> 🌸 *${cfg.botName}*\n> Regístrate primero, amor. Usa .register nombre edad 🍃` }, { quoted: msg })
        }
        
        const citado = msg.message?.extendedTextMessage?.contextInfo?.participant
        const mencionado = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
        const targetJid = mencionado || citado

        if (!targetJid) {
            return sock.sendMessage(from, { text: `> 🍃 Menciona a alguien o responde a su mensaje para robarle.` }, { quoted: msg })
        }
        
        const targetNumber = cleanNumber(await getRealJid(sock, targetJid, msg))
        
        if (targetNumber === realNumber) {
            return sock.sendMessage(from, { text: `> 🍃 No seas bárbaro, no puedes robarte a ti mismo.` }, { quoted: msg })
        }

        const target = getUser(targetNumber)
        if (!target.name) {
            return sock.sendMessage(from, { text: `> 🍃 Esa persona no está registrada.` }, { quoted: msg })
        }
        
        if (Date.now() - user.robLast < COOLDOWN) {
            const restante = COOLDOWN - (Date.now() - user.robLast)
            const minutos = Math.ceil(restante / (1000 * 60))
            return sock.sendMessage(from, { text: `> ⏳ La policía te busca, espera *${minutos} minutos* 🌿` }, { quoted: msg })
        }
        
        const exito = Math.random() < TASA_EXITO
        
        if (exito) {
            const porcentaje = (Math.random() * (0.25 - 0.15) + 0.15)
            const cantidad = Math.floor(target.kryons * porcentaje)
            
            if (cantidad < 1 || target.kryons < 50) {
                return sock.sendMessage(from, { text: `> 🍃 ${target.name} está más pobre que tú, no vale la pena.` }, { quoted: msg })
            }
            
            user.kryons += cantidad
            target.kryons -= cantidad
            user.robLast = Date.now()
            
            await updateUser(realNumber, { kryons: user.kryons, robLast: user.robLast })
            await updateUser(targetNumber, { kryons: target.kryons })
            
            await sock.sendMessage(from, { react: { text: '🥷', key: msg.key } })
            await sock.sendMessage(from, { text: `> 🌸 *${user.name}* le robó *${cantidad} ${cfg.kryons}* a *${target.name}*. 🥷🍃` }, { quoted: msg })
        } else {
            const multa = Math.floor(user.kryons * 0.10)
            user.kryons -= multa
            user.robLast = Date.now()
            
            await updateUser(realNumber, { kryons: user.kryons, robLast: user.robLast })
            
            await sock.sendMessage(from, { react: { text: '👮‍♂️', key: msg.key } })
            await sock.sendMessage(from, { text: `> ❌ *${user.name}* intentó robar a *${target.name}* y pagó *${multa} ${cfg.kryons}* de multa. 👮‍♂️🍃` }, { quoted: msg })
        }
    }
}