// creditos a YJ-EspinoX
import axios from 'axios'

async function axiosConReintentos(config, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      return await axios(config)
    } catch (e) {
      if (i < intentos) await new Promise(r => setTimeout(r, 1500 * i))
    }
  }
  return null
}

export default {
  command: ['pinterest', 'pin', 'pindl'],
  tag: 'pinterest',
  categoria: 'descargas',
  descripcion: 'Busca y descarga un álbum de 10 imágenes de Pinterest',
  owner: false,
  group: false,
  nsfw: false,

  async execute(sock, msg, { from, args }) {
    const query = args.join(' ')
    if (!query) return sock.sendMessage(from, { text: global.messages.busquedaEmpty }, { quoted: msg })

    try {
      await sock.sendMessage(from, { react: { text: global.getRandomReaction('media'), key: msg.key } })

      const session = await axiosConReintentos({
        url: 'https://es.pinterest.com/',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      })

      if (!session) {
        return sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
      }

      const cookies = session.headers['set-cookie']?.join('; ') || ''
      const csrfToken = cookies.match(/csrftoken=([^;]+)/)?.[1] || 'e6336e00000000000000000000000000'

      const searchUrl = 'https://es.pinterest.com/resource/BaseSearchResource/get/'
      const params = new URLSearchParams({
        'source_url': `/search/pins/?q=${encodeURIComponent(query)}`,
        'data': JSON.stringify({
          "options": { "query": query, "scope": "pins", "count": 50 },
          "context": {}
        })
      })

      const searchRes = await axiosConReintentos({
        method: 'post',
        url: searchUrl,
        data: params,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': csrfToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://es.pinterest.com/',
          'Cookie': cookies
        }
      })

      if (!searchRes) {
        return sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
      }

      const results = searchRes.data.resource_response?.data?.results || []
      if (results.length === 0) {
        return sock.sendMessage(from, { text: global.messages.busquedaNotFound }, { quoted: msg })
      }

      const shuffled = results.sort(() => 0.5 - Math.random())
      const selectedPins = shuffled.slice(0, 10)

      let albumKey = null
      let enviados = 0

      for (const pin of selectedPins) {
        try {
          const imageUrl = pin.images.orig.url

          const imageResponse = await axiosConReintentos({
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 10000
          })

          if (!imageResponse) continue

          const buffer = Buffer.from(imageResponse.data)

          if (!albumKey) {
            const album = sock.generateWAMessageFromContent(from, {
              messageContextInfo: {},
              albumMessage: {
                expectedImageCount: selectedPins.length,
                expectedVideoCount: 0,
                contextInfo: {
                  remoteJid: msg.key.remoteJid,
                  fromMe: msg.key.fromMe,
                  stanzaId: msg.key.id,
                  participant: msg.key.participant || msg.key.remoteJid,
                  quotedMessage: msg.message
                }
              }
            }, {})
            await sock.relayMessage(from, album.message, { messageId: album.key.id })
            albumKey = album.key
          }

          const mediaMsg = await sock.generateWAMessage(from, {
            image: buffer
          }, { upload: sock.waUploadToServer })

          mediaMsg.message.messageContextInfo = {
            messageAssociation: { associationType: 1, parentMessageKey: albumKey }
          }

          await sock.relayMessage(from, mediaMsg.message, { messageId: mediaMsg.key.id })
          enviados++

        } catch {
          continue
        }
      }

      if (enviados === 0) {
        return sock.sendMessage(from, { text: global.messages.descargaError }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch {
      return sock.sendMessage(from, { text: global.messages.error }, { quoted: msg })
    }
  }
}