import axios from 'axios'

export default {
  command: ['twitter', 'x', 'tw'],
  execute: async (sock, msg, { from, args }) => {
    if (!args[0]) return sock.sendMessage(from, { text: `> *Ingrese una url de Twitter* 🐦` }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    try {
      // --- Lógica del Scraper Integrada ---
      const normalized = args[0]
        .replace(/x\.com/, 'twitter.com')
        .replace('twitter.com', 'api.vxtwitter.com')

      const { data } = await axios.get(normalized)

      if (!data?.media_extended?.length) throw new Error()

      const meta = {
        title: data.text,
        author: data.user_name,
        likes: toNum(data.likes),
        author_user: data.user_screen_name
      }

      const caption = `*Post:* ${meta.title?.slice(0, 100) || 'Twitter Media'}\n*Autor:* ${meta.author} (@${meta.author_user})\n*Likes:* ${meta.likes}`

      // --- Envío de Media ---
      for (const item of data.media_extended) {
        const type = item.type === 'image' ? 'image' : 'video'
        await sock.sendMessage(from, { 
          [type]: { url: item.url }, 
          caption: caption 
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}

// Función auxiliar para formatear números (Likes, Retweets)
function toNum(number) {
  number = Number(number) || 0
  const abs = Math.abs(number)
  const sign = number < 0 ? '-' : ''
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + 'k'
  return number.toString()
}