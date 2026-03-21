export default {
  command: ['ping', 'p'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, isGroup, senderNumber }) {
    const start = Date.now()
    await sock.sendMessage(from, { text: '🏓 Calculando...' }, { quoted: msg })
    const latency = Date.now() - start

    await sock.sendMessage(from, { 
      text: `🏓 Pong! ${latency}ms` 
    }, { quoted: msg })
  }
}