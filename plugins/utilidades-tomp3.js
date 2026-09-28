// plugins/extraer-audio.js

import { downloadMediaMessage } from '@itsmelody/baileys'
import { execFile } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import ffmpegPath from 'ffmpeg-static'

const tempDir = join(process.cwd(), 'temp')
if (!existsSync(tempDir)) import('fs').then(fs => fs.mkdirSync(tempDir, { recursive: true }))

const AUDIO_TYPES = ['audioMessage', 'videoMessage', 'documentMessage']

export default {
  command: ['toaudio', 'tomp3'],
  tag: 'tomp3',
  categoria: 'utilidad',
  owner: false,
  group: false,
  nsfw: false,
  descripcion: 'Extrae el audio de un video, audio o documento',

  async execute(sock, msg, { from }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const messageToDownload = quoted || msg.message
    const mediaType = Object.keys(messageToDownload || {}).find(k => AUDIO_TYPES.includes(k))

    if (!mediaType) {
      return sock.sendMessage(from, {
        text: 'Responde a un video, audio o documento con *.toaudio* para extraer el audio.'
      }, { quoted: msg })
    }

    try {
      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

      const buffer = await downloadMediaMessage(
        { message: messageToDownload },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      )

      if (!buffer) throw new Error('Buffer vacío')

      const inputPath = join(tempDir, `${Date.now()}_in.tmp`)
      const outputPath = join(tempDir, `${Date.now()}.mp3`)
      await writeFile(inputPath, buffer)

      await new Promise((resolve, reject) => {
        execFile(ffmpegPath, [
          '-i', inputPath,
          '-codec:a', 'libmp3lame',
          '-b:a', '128k',
          '-q:a', '2',
          '-y', outputPath
        ], (err) => {
          if (err) return reject(err)
          resolve()
        })
      })

      await sock.sendMessage(from, {
        audio: { url: outputPath },
        mimetype: 'audio/mpeg'
      }, { quoted: msg })

      await sock.sendMessage(from, { react: { text: '🟢', key: msg.key } })

      await unlink(inputPath)
      await unlink(outputPath)

    } catch (err) {
      console.error('[toaudio]', err.message)
      await sock.sendMessage(from, { react: { text: '🔴', key: msg.key } })
      await sock.sendMessage(from, { text: 'No pude extraer el audio.' }, { quoted: msg })
    }
  }
}