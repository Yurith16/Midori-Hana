export default {
  command: ['code'],
  execute: async (sock, msg, { args, from, config }) => {
    // Verificar si subbot está habilitado
    if (!config?.subbot) {
      await sock.sendMessage(from, {
        text: '> ❌ El sistema de subbots está desactivado.'
      }, { quoted: msg })
      return
    }

    // Sin argumentos — mostrar ayuda
    if (!args.length) {
      await sock.sendMessage(from, {
        text: [
          '╭─〔 *𝗦𝘂𝗯𝗯𝗼𝘁* 〕',
          '│',
          '│ Vincula un número como subbot.',
          '│',
          '│ *Uso:*',
          '│ › .code 50496926150',
          '│',
          '│ › El número debe estar activo',
          '│   en WhatsApp.',
          '│',
          '╰─────────────────'
        ].join('\n')
      }, { quoted: msg })
      return
    }

    const { countActive, connectSubbot } = await import('../../subbot.js')
    const { default: cfg } = await import('../../config.js')

    // Verificar límite
    if (countActive() >= (cfg.maxSubbots || 5)) {
      await sock.sendMessage(from, {
        text: '> ❌ Se alcanzó el límite máximo de subbots activos.'
      }, { quoted: msg })
      return
    }

    // Limpiar número
    const numero = args[0].replace(/\D/g, '').trim()
    if (!numero || numero.length < 8) {
      await sock.sendMessage(from, {
        text: '> ❌ Número inválido. Ejemplo: `.code 50496926150`'
      }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    await sock.sendMessage(from, {
      text: `> ⏳ Solicitando código para *${numero}*...`
    }, { quoted: msg })

    try {
      await connectSubbot(
        numero,
        // onCode
        async (code) => {
          await sock.sendMessage(from, {
            text: [
              '╭─〔 *𝗖𝗼́𝗱𝗶𝗴𝗼 𝗱𝗲 𝗩𝗶𝗻𝗰𝘂𝗹𝗮𝗰𝗶𝗼́𝗻* 〕',
              '│',
              `│ › Número: *${numero}*`,
              '│',
              `│ › Código: *${code}*`,
              '│',
              '│ › WhatsApp → Ajustes →',
              '│   Dispositivos vinculados →',
              '│   Vincular dispositivo →',
              '│   Ingresar código',
              '│',
              '│ › Válido por 60 segundos.',
              '│',
              '╰─────────────────'
            ].join('\n')
          }, { quoted: msg })
        },
        // onConnect
        async (num) => {
          await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
          await sock.sendMessage(from, {
            text: `> ✅ Subbot *${num}* conectado exitosamente.`
          }, { quoted: msg })
        },
        // onDisconnect
        async (num, reason) => {
          await sock.sendMessage(from, {
            text: `> ⚠️ Subbot *${num}* desconectado. (${reason})`
          }, { quoted: msg })
        }
      )
    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      await sock.sendMessage(from, {
        text: `> ❌ Error al iniciar subbot: ${err.message}`
      }, { quoted: msg })
    }
  }
}