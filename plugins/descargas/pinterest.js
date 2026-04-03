import axios from 'axios'
import '../../config.js'

export default {
  command: ['pinterest', 'pin'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { text: '> ¿Qué imágenes deseas buscar? 🍃' }, { quoted: msg })
      return
    }
    
    await sock.sendMessage(from, { react: { text: '📌', key: msg.key } })
    
    try {
      const query = args.join(' ')
      const apiUrl = `https://api.delirius.store/search/pinterestv2?text=${encodeURIComponent(query)}`
      const { data } = await axios.get(apiUrl, { timeout: 15000 })
      
      if (!data.status || !data.data || data.data.length === 0) {
        throw new Error('No encontrado')
      }
      
      const imagenes = data.data.sort(() => 0.5 - Math.random()).slice(0, 6)
      const medias = imagenes.map(img => ({
        type: 'image',
        data: { url: img.image }
      }))

      const caption = ` *BÚSQUEDA:* ${query}\n` +
                      ` *CANTIDAD:* ${medias.length}\n\n` +
                      `> ${global.botName || '© kari'}`;

      const album = sock.generateWAMessageFromContent(from, {
        messageContextInfo: {},
        albumMessage: {
          expectedImageCount: medias.length,
          expectedVideoCount: 0,
          contextInfo: {
            remoteJid: msg.key.remoteJid,
            fromMe: msg.key.fromMe,
            stanzaId: msg.key.id,
            participant: msg.key.participant || msg.key.remoteJid,
            quotedMessage: msg.message,
          }
        }
      }, {});

      await sock.relayMessage(from, album.message, { messageId: album.key.id });

      for (let i = 0; i < medias.length; i++) {
        const { type, data: mediaData } = medias[i];
        const mediaMsg = await sock.generateWAMessage(from, {
          [type]: mediaData,
          ...(i === 0 ? { caption } : {})
        }, { upload: sock.waUploadToServer });

        mediaMsg.message.messageContextInfo = {
          messageAssociation: { associationType: 1, parentMessageKey: album.key }
        };

        await sock.relayMessage(from, mediaMsg.message, { messageId: mediaMsg.key.id });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }
  }
}