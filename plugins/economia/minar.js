import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import cfg from '../../config.js'

export default {
    command: ['mine', 'minar'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: '> 🍃 necesitas estar en mi base de datos para usar estos comandos.' }, { quoted: msg })
        }
        
        const COOLDOWN = 10 * 60 * 1000 // 10 minutos
        if (Date.now() - user.workLast < tiempo) {
            const restante = tiempo - (Date.now() - user.workLast)
            const minutos = Math.ceil(restante / (1000 * 60))
            return sock.sendMessage(from, { text: `> ⏳ Aún descansando, vuelve en *${minutos} minutos* 🌿` }, { quoted: msg })
        }
        
        const kryonsGanados = Math.floor(Math.random() * 151) + 50 // 50 a 200
        const expGanada = Math.floor(Math.random() * 31) + 10 // 10 a 40
        
        const nuevosKryons = user.kryons + kryonsGanados
        const nuevaExp = user.exp + expGanada
        
        const nuevoNivel = Math.floor(nuevaExp / 1000) + 1
        
        await updateUser(realNumber, { 
            kryons: nuevosKryons, 
            exp: nuevaExp,
            level: nuevoNivel,
            workLast: Date.now() 
        })
        
        const txt = `> 🍃 haz minado +${kryonsGanados} ${cfg.kryons} y +${expGanada} ${cfg.exp}`
        
        await sock.sendMessage(from, { react: { text: '💰', key: msg.key } })
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
    }
}