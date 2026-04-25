import { getSubbotSettings, updateSubbotSettings } from '../../database/db-subbot.js'

export default {
  command: ['sbdelprefix', 'sbremovepf', 'sbdelpf'],
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

    const objetivo = args[0]

    if (!objetivo) {
      const settings = await getSubbotSettings(subbotNumero)
      const prefijos = settings.prefijos || ['.']
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: `> 🍃 *USO:* \`.sbdelprefix <símbolo>\`\n> 📌 Prefijos actuales: ${prefijos.map(p => `\`${p}\``).join(', ')}` }, { quoted: msg })
      return
    }

    const settings = await getSubbotSettings(subbotNumero)
    let prefijos = settings.prefijos || ['.']

    if (!Array.isArray(prefijos)) {
      prefijos = ['.']
    }

    if (!prefijos.includes(objetivo)) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: `> El prefijo \`${objetivo}\` no existe en este subbot 🍃\n> 📌 Prefijos activos: ${prefijos.map(p => `\`${p}\``).join(', ')}` }, { quoted: msg })
      return
    }

    if (prefijos.length === 1) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Debe quedar al menos un prefijo activo en el subbot 🍃' }, { quoted: msg })
      return
    }

    const actualizados = prefijos.filter(p => p !== objetivo)
    await updateSubbotSettings(subbotNumero, { prefijos: actualizados })

    await sock.sendMessage(from, {
      text: `> ✅ Prefijo \`${objetivo}\` eliminado del subbot 🍃\n> 📌 Prefijos activos: ${actualizados.map(p => `\`${p}\``).join(', ')}`
    }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}