import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'

ffmpeg.setFfmpegPath(ffmpegPath)

const queue = []
let processing = false

async function processQueue() {
  if (processing || queue.length === 0) return
  processing = true

  const { input, output, resolve, reject, type } = queue.shift()

  try {
    if (type === 'video') {
      await convertVideo(input, output)
    } else {
      await convertAudio(input, output)
    }
    resolve(output)
  } catch (err) {
    reject(err)
  } finally {
    processing = false
    processQueue()
  }
}

function convertAudio(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .audioBitrate(128)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('end', () => resolve(output))
      .on('error', reject)
      .save(output)
  })
}

function convertVideo(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .format('mp4')
      .outputOptions([
        '-preset ultrafast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .on('end', () => resolve(output))
      .on('error', reject)
      .save(output)
  })
}

export async function toMp3(inputPath) {
  const outputPath = inputPath.replace(/\.\w+$/, '.mp3')

  if (inputPath === outputPath) {
    const dir = path.dirname(inputPath)
    const ext = path.extname(inputPath)
    const base = path.basename(inputPath, ext)
    return toMp3(path.join(dir, `${base}_converted.mp3`))
  }

  return new Promise((resolve, reject) => {
    queue.push({ input: inputPath, output: outputPath, resolve, reject, type: 'audio' })
    processQueue()
  })
}

export async function toMp4(inputPath) {
  const outputPath = inputPath.replace(/\.\w+$/, '.mp4')

  if (inputPath === outputPath) {
    const dir = path.dirname(inputPath)
    const ext = path.extname(inputPath)
    const base = path.basename(inputPath, ext)
    return toMp4(path.join(dir, `${base}_converted.mp4`))
  }

  return new Promise((resolve, reject) => {
    queue.push({ input: inputPath, output: outputPath, resolve, reject, type: 'video' })
    processQueue()
  })
}

export async function streamToFile(stream, outputPath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath)
    stream.pipe(writeStream)
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })
}