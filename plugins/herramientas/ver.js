import { downloadMediaMessage } from '@whiskeysockets/baileys'

export default {
  command: ['ver', 'view'],
  group: false,
  owner: false,

  async execute(sock, msg, { from }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const quotedKey = msg.message?.extendedTextMessage?.contextInfo

    if (!quoted) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> Responde al mensaje que quieres ver 🍃' }, { quoted: msg })
      return
    }

    try {
      // Detectar tipo de media incluyendo viewOnce
      const inner =
        quoted.viewOnceMessage?.message ||
        quoted.viewOnceMessageV2?.message ||
        quoted.viewOnceMessageV2Extension?.message ||
        quoted

      const imageMsg = inner.imageMessage
      const videoMsg = inner.videoMessage
      const audioMsg = inner.audioMessage
      const stickerMsg = inner.stickerMessage
      const docMsg = inner.documentMessage
      const textMsg = inner.conversation || inner.extendedTextMessage?.text

      // Solo texto
      if (textMsg && !imageMsg && !videoMsg && !audioMsg && !stickerMsg && !docMsg) {
        await sock.sendMessage(from, { text: textMsg }, { quoted: msg })
        return
      }

      // Construir mensaje para descarga
      const msgToDownload = {
        key: {
          remoteJid: from,
          id: quotedKey.stanzaId,
          participant: quotedKey.participant
        },
        message: inner
      }

      const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {})

      if (imageMsg) {
        await sock.sendMessage(from, {
          image: buffer,
          caption: imageMsg.caption || ''
        }, { quoted: msg })

      } else if (videoMsg) {
        await sock.sendMessage(from, {
          video: buffer,
          caption: videoMsg.caption || '',
          mimetype: videoMsg.mimetype || 'video/mp4'
        }, { quoted: msg })

      } else if (audioMsg) {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: audioMsg.mimetype || 'audio/mpeg',
          ptt: audioMsg.ptt || false
        }, { quoted: msg })

      } else if (stickerMsg) {
        await sock.sendMessage(from, {
          sticker: buffer
        }, { quoted: msg })

      } else if (docMsg) {
        await sock.sendMessage(from, {
          document: buffer,
          mimetype: docMsg.mimetype,
          fileName: docMsg.fileName || 'archivo'
        }, { quoted: msg })

      } else {
        await sock.sendMessage(from, { text: '> No se pudo revelar este tipo de mensaje 🍃' }, { quoted: msg })
      }

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se pudo revelar el mensaje 🍃' }, { quoted: msg })
    }
  }
}