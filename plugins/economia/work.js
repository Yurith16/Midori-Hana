import { getRealJid, cleanNumber } from '../../utils/jid.js'
import { getUser, updateUser } from '../../database/db.js'
import cfg from '../../config.js'

const trabajos = [
    { nombre: 'chofer', kryons: [80, 120], exp: [20, 40] },
    { nombre: 'programador', kryons: [150, 250], exp: [40, 60] },
    { nombre: 'cocinero', kryons: [60, 100], exp: [15, 30] },
    { nombre: 'profesor', kryons: [90, 140], exp: [25, 45] },
    { nombre: 'médico', kryons: [120, 180], exp: [30, 50] },
    { nombre: 'constructor', kryons: [100, 160], exp: [20, 35] },
    { nombre: 'policía', kryons: [110, 170], exp: [25, 40] },
    { nombre: 'bombero', kryons: [95, 150], exp: [22, 38] },
    { nombre: 'camarero', kryons: [50, 90], exp: [10, 25] },
    { nombre: 'repartidor', kryons: [70, 110], exp: [15, 30] },
    { nombre: 'jardinero', kryons: [60, 100], exp: [12, 28] },
    { nombre: 'pintor', kryons: [80, 130], exp: [18, 35] },
    { nombre: 'electricista', kryons: [100, 150], exp: [20, 40] },
    { nombre: 'mecánico', kryons: [90, 140], exp: [20, 38] },
    { nombre: 'veterinario', kryons: [85, 135], exp: [18, 35] }
]

const COOLDOWN = 10 * 60 * 1000 // 10 minutos

export default {
    command: ['work', 'trabajar'],
    execute: async (sock, msg, { from }) => {
        const userId = msg.key.participant || from
        const realNumber = cleanNumber(await getRealJid(sock, userId, msg))
        const user = getUser(realNumber)
        
        if (!user.name || !user.age) {
            return sock.sendMessage(from, { text: '> 🍃 necesitas estar en mi base de datos para usar estos comandos.' }, { quoted: msg })
        }
        
        if (Date.now() - user.workLast < COOLDOWN) {
            const restante = COOLDOWN - (Date.now() - user.workLast)
            const minutos = Math.ceil(restante / (1000 * 60))
            return sock.sendMessage(from, { text: `> ⏳ Aún descansando, vuelve en *${minutos} minutos* 🌿` }, { quoted: msg })
        }
        
        const trabajo = trabajos[Math.floor(Math.random() * trabajos.length)]
        const kryonsGanados = Math.floor(Math.random() * (trabajo.kryons[1] - trabajo.kryons[0] + 1)) + trabajo.kryons[0]
        const expGanada = Math.floor(Math.random() * (trabajo.exp[1] - trabajo.exp[0] + 1)) + trabajo.exp[0]
        
        const nuevosKryons = user.kryons + kryonsGanados
        const nuevaExp = user.exp + expGanada
        const nuevoNivel = Math.floor(nuevaExp / 1000) + 1
        
        await updateUser(realNumber, { 
            kryons: nuevosKryons, 
            exp: nuevaExp,
            level: nuevoNivel,
            workLast: Date.now() 
        })
        
        const txt = `> 🍃 Trabajaste como ${trabajo.nombre} y recibiste +${kryonsGanados} ${cfg.kryons} y +${expGanada} ${cfg.exp}`
        
        await sock.sendMessage(from, { react: { text: '💼', key: msg.key } })
        await sock.sendMessage(from, { text: txt }, { quoted: msg })
    }
}