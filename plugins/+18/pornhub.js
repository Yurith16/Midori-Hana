import axios from 'axios'
import fs from 'fs'
import path from 'path'
import config from '../../config.js' 

export default {
    command: ['pornhubdl', 'phdl'],
    execute: async (sock, msg, { args, from, text }) => {
        const url = text || args[0]

        // 1. Verificación de Grupo Exclusivo
if (from !== config.nsfwGroupId) {
    await sock.sendMessage(from, { react: { text: '🔞', key: msg.key } })
    
    // Forzamos el envío como texto simple para evitar el "Invalid media type"
    return sock.sendMessage(from, { 
        text: String(config.nsfwMessage) 
    }, { quoted: msg })
}

        // Carpeta temporal segura
        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir)

        await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

        try {
            const apiUrl = `https://api.delirius.store/download/pornhub?url=${encodeURIComponent(url)}`
            const { data: res } = await axios.get(apiUrl)

            if (!res.status || !res.data) throw new Error('No data')

            // Buscamos calidad 480p o 360p para que el archivo no sea demasiado pesado
            const videoData = res.data.video.find(v => v.quality === '480') || res.data.video.find(v => v.quality === '360')
            if (!videoData) throw new Error('Calidad no permitida')

            await sock.sendMessage(from, { react: { text: '📥', key: msg.key } })

            const fileName = `ph_${Date.now()}.mp4`
            const filePath = path.join(tmpDir, fileName)

            // Descarga mediante Stream para mayor estabilidad
            const response = await axios({
                method: 'get',
                url: videoData.download,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://www.pornhub.com/'
                }
            })

            const writer = fs.createWriteStream(filePath)
            response.data.pipe(writer)

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve)
                writer.on('error', reject)
            })

            await sock.sendMessage(from, { react: { text: '📤', key: msg.key } })

            // 3. Envío del video con diseño AD Reply
            const enviado = await sock.sendMessage(from, {
                document: { url: filePath },
                mimetype: 'video/mp4',
                fileName: `${res.data.title}.mp4`,
                contextInfo: {
                    externalAdReply: {
                        title: res.data.title,
                        body: `Calidad: ${videoData.quality}p | Kari Bot`,
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        thumbnailUrl: res.data.image,
                        sourceUrl: url
                    }
                }
            }, { quoted: msg })

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

            // Borrado físico del archivo temporal
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
                console.log(`[LIMPIEZA] ${fileName} eliminado.`)
            }

        } catch (err) {
            console.error('Error Pornhub:', err.message)
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
            await sock.sendMessage(from, { text: `> ❌ *Error:* No se pudo descargar el contenido.` }, { quoted: msg })
        }
    }
}