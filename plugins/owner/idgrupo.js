export default {
    command: ['id', 'jid', 'groupid'],
    async execute(sock, msg, { from }) {
        
        // Reacción estética
        await sock.sendMessage(from, { react: { text: '🆔', key: msg.key } })

        // Diseño limpio con el resaltado que te gusta
        const txt = `> 🆔 *IDENTIFICADOR DE CHAT*\n\n` +
                    `> 📌 *ID:* ${from}\n\n` +
                    `> 🍃 Copia este código para tu configuración, Hernández.`

        await sock.sendMessage(from, { text: txt }, { quoted: msg })
    }
}