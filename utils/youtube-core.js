import fs from 'fs'
import path from 'path'
import { exec, execSync } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

const YTDLP_PATH = path.join(process.cwd(), 'yt-dlp')
const TEMP_DIR = path.join(process.cwd(), 'tmp', 'youtube')

// Asegurar permisos y carpetas en cada carga
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

function ensurePermissions() {
    try {
        if (fs.existsSync(YTDLP_PATH)) {
            execSync(`chmod 777 ${YTDLP_PATH}`)
        }
    } catch (e) {
        console.error('Error ajustando permisos:', e.message)
    }
}

class YTSearch {
    async search(query) {
        ensurePermissions()
        try {
            // Intentamos ejecutar con python3 por delante, que es más estable en Codespaces
            const { stdout } = await execPromise(`python3 ${YTDLP_PATH} --dump-json --no-playlist "ytsearch1:${query}"`)
            if (!stdout) return { videos: [] }
            const data = JSON.parse(stdout)
            return {
                videos: [{
                    videoId: data.id,
                    title: data.title,
                    thumbnail: data.thumbnail,
                    author: { name: data.uploader },
                    views: data.view_count,
                    duration: { seconds: data.duration }
                }]
            }
        } catch (error) {
            // Si falla python3, intentamos ejecución directa como último recurso
            try {
                const { stdout } = await execPromise(`${YTDLP_PATH} --dump-json --no-playlist "ytsearch1:${query}"`)
                const data = JSON.parse(stdout)
                return { videos: [{ videoId: data.id, title: data.title, thumbnail: data.thumbnail, author: { name: data.uploader }, views: data.view_count, duration: { seconds: data.duration } }] }
            } catch (e) {
                return { videos: [] }
            }
        }
    }

    async getInfo({ videoId }) {
        ensurePermissions()
        const url = videoId.startsWith('http') ? videoId : `https://youtu.be/${videoId}`
        try {
            const { stdout } = await execPromise(`python3 ${YTDLP_PATH} --dump-json --no-playlist "${url}"`)
            if (!stdout) return null
            const data = JSON.parse(stdout)
            return {
                videoId: data.id,
                title: data.title,
                thumbnail: data.thumbnail,
                author: { name: data.uploader },
                views: data.view_count,
                duration: { seconds: data.duration }
            }
        } catch (error) {
            return null
        }
    }
}

const yts = new YTSearch()

export async function getVideoMetadata(query) {
    try {
        const isUrl = /youtu\.be|youtube\.com/.test(query)
        let info
        if (isUrl) {
            info = await yts.getInfo({ videoId: query })
        } else {
            const search = await yts.search(query)
            info = search.videos[0]
        }
        if (!info) return null
        return { ...info, url: info.url || `https://youtu.be/${info.videoId}` }
    } catch (e) { return null }
}

export async function downloadMedia(videoId, type = 'audio') {
    ensurePermissions()
    const ext = type === 'audio' ? 'mp3' : 'mp4'
    const outputFile = path.join(TEMP_DIR, `${videoId}_${Date.now()}.${ext}`)
    const url = `https://youtu.be/${videoId}`
    
    const command = type === 'audio' 
        ? `python3 ${YTDLP_PATH} -f bestaudio --extract-audio --audio-format mp3 -o "${outputFile}" "${url}"`
        : `python3 ${YTDLP_PATH} -f "best[ext=mp4]" -o "${outputFile}" "${url}"`
    
    await execPromise(command)
    if (!fs.existsSync(outputFile)) throw new Error('Archivo no generado')
    return outputFile
}