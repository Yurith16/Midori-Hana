export default {
  command: ['code'],
  execute: async (sock, msg, { args, from, config }) => {
    if (!config?.subbot) {
      await sock.sendMessage(from, {
        text: '> ❌ El sistema de subbots está desactivado.'
      }, { quoted: msg })
      return
    }

    if (!args.length) {
      await sock.sendMessage(from, {
        text: '> 🍃 *USO:* `.code 50496926150`'
      }, { quoted: msg })
      return
    }

    const { countActive, connectSubbot, getActiveSubs } = await import('../../subbot.js')
    const { default: cfg } = await import('../../config.js')

    const maxSubbots = cfg.maxSubbots || 3
    const activos = countActive()

    if (activos >= maxSubbots) {
      await sock.sendMessage(from, {
        text: `> ❌ Límite alcanzado: *${activos}/${maxSubbots}* subbots activos.`
      }, { quoted: msg })
      return
    }

    const numero = args[0].replace(/\D/g, '').trim()
    if (!numero || numero.length < 10) {
      await sock.sendMessage(from, {
        text: '> ❌ Número inválido. Ejemplo: `.code 50496926150`'
      }, { quoted: msg })
      return
    }

    const existingSub = getActiveSubs().get(numero)
    if (existingSub) {
      await sock.sendMessage(from, {
        text: `> ⚠️ El número *${numero}* ya está conectado como subbot.`
      }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    await sock.sendMessage(from, { text: `> ⏳ Solicitando código para *${numero}*...` }, { quoted: msg })

    try {
      await connectSubbot(
        numero,
        async (code) => {
          await sock.sendMessage(from, {
            text: `╭─〔 🌸 *${config.botName?.toUpperCase() || 'MIDORI-HANA'}* 🌸 〕\n│\n│ 🍃 *Código:* ${code}\n│\n╰─────────────────`
          }, { quoted: msg })
        },
        async (num) => {
          await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
          await sock.sendMessage(from, {
            text: `> ✅ Subbot *${num}* conectado exitosamente.\n> 🍃 Activos: *${activos + 1}/${maxSubbots}*`
          }, { quoted: msg })
        },
        async (num, reason) => {
          await sock.sendMessage(from, {
            text: `> ⚠️ Subbot *${num}* desconectado.\n> 🍃 Razón: ${reason}`
          }, { quoted: msg })
        }
      )
    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      await sock.sendMessage(from, {
        text: `> ❌ Error: ${err.message}`
      }, { quoted: msg })
    }
  }
}