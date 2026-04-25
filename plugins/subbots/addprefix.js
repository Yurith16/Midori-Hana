import { getSubbotSettings, updateSubbotSettings } from '../../database/db-subbot.js'

export default {
  command: ['sbaddprefix', 'sbaddpf'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, isOwner, isSubbotOwner, subbotNumero }) {
    if (!subbotNumero) {
      await sock.sendMessage(from, { text: '> ❌ Este comando solo funciona en subbots.' }, { quoted: msg })
      return
    }

    if (!isOwner && !isSubbotOwner) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      await sock.sendMessage(from, { text: '> Solo el dueño del subbot puede cambiar los prefijos.' }, { quoted: msg })
      return
    }

    const nuevo = args[0]

    if (!nuevo) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> 🍃 *USO:* `.sbaddprefix <símbolo>`\n> Ejemplo: `.sbaddprefix !`' }, { quoted: msg })
      return
    }

    if (nuevo.length > 3) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> El prefijo no puede tener más de 3 caracteres 🍃' }, { quoted: msg })
      return
    }

    const settings = await getSubbotSettings(subbotNumero)
    let prefijos = settings.prefijos || ['.']

    if (!Array.isArray(prefijos)) {
      prefijos = ['.']
    }

    if (prefijos.includes(nuevo)) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: `> El prefijo \`${nuevo}\` ya existe en este subbot 🍃` }, { quoted: msg })
      return
    }

    prefijos.push(nuevo)
    await updateSubbotSettings(subbotNumero, { prefijos: prefijos })

    await sock.sendMessage(from, {
      text: `> ✅ Prefijo \`${nuevo}\` agregado al subbot 🍃\n> 📌 Prefijos activos: ${prefijos.map(p => `\`${p}\``).join(', ')}`
    }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}