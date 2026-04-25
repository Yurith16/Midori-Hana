import { getGroupConfig, updateGroupConfig } from '../../database/db.js'
import { getSubbotGroupConfig, updateSubbotGroupConfig } from '../../database/db-subbot.js'

export default {
  command: ['setwelcome', 'sw'],
  group: true,
  owner: false,

  async execute(sock, msg, { args, from, isOwner, subbotNumero }) {
    try {
      const metadata = await sock.groupMetadata(from)
      const sender = msg.key.participant || msg.key.remoteJid
      const isAdmin = metadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                      metadata.participants.find(p => p.id === sender)?.admin === 'superadmin'

      if (!isAdmin && !isOwner) {
        await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
        await sock.sendMessage(from, { text: '> No tienes permisos para usar este comando 🍃' }, { quoted: msg })
        return
      }

      // Usar DB de subbot o principal
      let currentText
      if (subbotNumero) {
        const cfg = await getSubbotGroupConfig(subbotNumero, from)
        currentText = cfg.welcomeText
      } else {
        const cfg = getGroupConfig(from)
        currentText = cfg.welcomeText
      }

      if (!args.length) {
        await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
        await sock.sendMessage(from, {
          text: `> *Bienvenida actual* 🍃\n\n${currentText || global.config.welcomeText || '> 👋 Bienvenido @user al grupo'}\n\n> Usa *@user* donde quieres que aparezca la mención\n> Ejemplo: .setwelcome Hola @user, bienvenido al grupo 🎉`
        }, { quoted: msg })
        return
      }

      const nuevoTexto = args.join(' ')

      if (!nuevoTexto.includes('@user')) {
        await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
        await sock.sendMessage(from, { text: '> El mensaje debe incluir *@user* para mencionar al nuevo miembro 🍃' }, { quoted: msg })
        return
      }

      // Guardar en DB correspondiente
      if (subbotNumero) {
        await updateSubbotGroupConfig(subbotNumero, from, { welcomeText: nuevoTexto })
      } else {
        await updateGroupConfig(from, { welcomeText: nuevoTexto })
      }

      await sock.sendMessage(from, {
        text: `> Mensaje de bienvenida actualizado 🍃\n\n${nuevoTexto}`
      }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error('[setwelcome] Error:', err)
      await sock.sendMessage(from, { text: '> ⚠️ Error interno, revisa la consola 🍃' }, { quoted: msg })
    }
  }
}