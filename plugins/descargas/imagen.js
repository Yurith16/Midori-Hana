import axios from 'axios'

export default {
  command: ['img', 'imagen', 'googleimg'],
  execute: async (sock, msg, { from, args }) => {
    // Validación estética inicial
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué imagen desea buscar?' }, { quoted: msg })
      return
    }

    const query = args.join(' ')
    await sock.sendMessage(from, { react: { text: '🍃', key: msg.key } })

    try {
      const { data: res } = await axios.post('https://panel.apinexus.fun/api/imagen/buscar', 
        { query: query }, 
        { headers: { 'x-api-key': 'antbx21e5jhac' } }
      )

      if (!res.success || !res.data || !res.data.imagenes || res.data.imagenes.length === 0) throw new Error()

      // Elegimos una imagen al azar de la lista
      const imgs = res.data.imagenes
      const randomImg = imgs[Math.floor(Math.random() * imgs.length)]

      // Enviamos la imagen sin caption
      const sentMsg = await sock.sendMessage(from, { 
        image: { url: randomImg }
      }, { quoted: msg })

      // Reaccionamos directamente al mensaje de la imagen enviada
      await sock.sendMessage(from, { 
        react: { text: '🍃', key: sentMsg.key } 
      })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
    }
  }
}