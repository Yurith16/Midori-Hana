import fs from 'fs'
import path from 'path'
import axios from 'axios'
import yts from 'yt-search'
import config from '../../config.js'
import { getVideo } from '../../utils/video-api.js'

const activeUsers = new Map()

export default {
  command: ['play2', 'ytmp4', 'ytv'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    
    if (activeUsers.has(userId)) return 

    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué video deseas descargar bb? 🤭' }, { quoted: msg })
      return
    }
    
    activeUsers.set(userId, true)
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    
    try {
      let videoUrl = args[0]
      let searchData = null
      
      if (!videoUrl.match(/youtu/gi)) {
        const search = await yts(`${args.join(' ')} video`)
        const video = search.videos.find(v => v.type === 'video') || search.videos[0]
        if (!video) throw new Error('Video no encontrado')
        
        videoUrl = video.url
        searchData = video
      }
      
      const result = await getVideo(videoUrl)
      if (!result || !result.url) throw new Error('API sin respuesta')

      const title = result.title || searchData?.title || 'Video de YouTube'
      const duration = searchData?.timestamp || result.duration || '0:00'
      const videoThumb = searchData?.thumbnail || result.thumb || config.defaultImg

      const head = await axios.head(result.url, { timeout: 10000 }).catch(() => null)
      const sizeBytes = parseInt(head?.headers?.['content-length'] || 0)
      const sizeMB = sizeBytes > 0 ? parseFloat((sizeBytes / 1024 / 1024).toFixed(2)) : 0

      if (sizeMB > 400) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        await sock.sendMessage(from, { text: `> El video es demasiado pesado para enviarlo oíste 🫢` }, { quoted: msg })
        return
      }

      const cleanName = `${title.substring(0, 30).replace(/[<>:"/\\|?*]/g, '')} - ${config.botName}.mp4`

      const sentMsg = await sock.sendMessage(from, {
        document: { url: result.url },
        mimetype: 'video/mp4',
        fileName: cleanName,
        caption: ` `,
        contextInfo: {
          forwardingScore: 9999999,
          isForwarded: true,
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: false,
            title: title,
            body: config.botName,
            containsAutoReply: true,
            mediaType: 1,
            thumbnailUrl: videoThumb,
            sourceUrl: videoUrl
          }
        }
      }, { quoted: msg })

      if (sentMsg) await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      
    } catch (err) {
      console.error('Error en Play2:', err.message)
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    } finally {
      activeUsers.delete(userId)
    }
  }
}