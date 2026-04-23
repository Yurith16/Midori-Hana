import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
ffmpeg.setFfmpegPath(ffmpegPath)

const TEMP_DIR = path.join(process.cwd(), 'temp_audio')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

async function toVoiceNote(buffer) {
  const inputPath = path.join(TEMP_DIR, `input_${Date.now()}.mp3`)
  const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.opus`)
  
  fs.writeFileSync(inputPath, buffer)
  
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('libopus')
      .audioBitrate('24k')
      .audioFrequency(16000)
      .audioChannels(1)
      .toFormat('ogg')
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath)
  })
  
  const result = fs.readFileSync(outputPath)
  fs.unlinkSync(inputPath)
  fs.unlinkSync(outputPath)
  
  return result
}

export default {
  command: ['tovn', 'notavoz'],
  execute: async (sock, msg, { from }) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const audioMsg = quoted?.audioMessage || quoted?.videoMessage || msg.message?.audioMessage || msg.message?.videoMessage

    if (!audioMsg) {
      await sock.sendMessage(from, { text: '> Responde a un audio o video con .tovn' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { text: '> 🎙️ *Convirtiendo a nota de voz...*' }, { quoted: msg })

    const msgToDownload = msg.message?.audioMessage || msg.message?.videoMessage ? msg : { key: msg.key, message: quoted }
    const buffer = await downloadMediaMessage(msgToDownload, 'buffer', {})

    const voiceNote = await toVoiceNote(buffer)

    await sock.sendMessage(from, {
      audio: voiceNote,
      mimetype: 'audio/ogg',
      ptt: true
    }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
  }
}