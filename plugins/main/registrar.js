import { registerUser } from '../../database/db.js'
import config from '../../config.js'

export default {
    command: ['reg', 'registrar', 'registrarme'],
    group: false,
    owner: false,

    async execute(sock, msg, { args, from, sender }) {
        try {
            // Verificamos que se pasen ambos argumentos
            if (!args[0] || !args[1]) {
                return sock.sendMessage(from, {
                    text: `> ⚠️ Formato incorrecto.\n> Usa: *${config.prefix}reg nombre edad*\n> Ejemplo: *${config.prefix}reg Hernandez 20* 🍃`
                }, { quoted: msg })
            }

            const name = args[0]
            const age = parseInt(args[1])

            // Validaciones básicas de edad
            if (isNaN(age)) {
                return sock.sendMessage(from, { text: '> ⚠️ La edad debe ser un número válido. 🍃' }, { quoted: msg })
            }

            if (age < 5 || age > 99) {
                return sock.sendMessage(from, { text: '> ⚠️ Por favor, ingresa una edad realista. 🍃' }, { quoted: msg })
            }

            // Guardamos en la base de datos
            await registerUser(sender, name, age)

            const regMsg = `
✅ *REGISTRO EXITOSO*
──────────────────
👤 *Nombre:* ${name}
🎂 *Edad:* ${age} años
✨ *Bono:* +100 ${config.kryons}

> Ya puedes usar *${config.prefix}perfil* para ver tus datos.
──────────────────
🌿 *${config.botName}*
`.trim()

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            await sock.sendMessage(from, { text: regMsg }, { quoted: msg })

        } catch (error) {
            console.error('Error en el comando registro:', error)
            await sock.sendMessage(from, { text: '> ❌ Ocurrió un error al intentar registrarte. 🍃' }, { quoted: msg })
        }
    }
}