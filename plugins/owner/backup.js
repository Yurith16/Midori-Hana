import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import archiver from 'archiver'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATABASE_PATH = path.join(__dirname, '../../database.json')
const BACKUP_DIR = path.join(__dirname, '../../tmp/backups')

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
}

export default {
    command: ['backup', 'respaldar'],
    group: false,
    owner: true,

    execute: async (sock, msg, { from }) => {
        if (!fs.existsSync(DATABASE_PATH)) {
            return sock.sendMessage(from, { text: '> ❌ No se encontró la base de datos.' }, { quoted: msg })
        }

        await sock.sendMessage(from, { react: { text: '📦', key: msg.key } })
        const processingMsg = await sock.sendMessage(from, { text: '> 📦 Comprimiendo base de datos...' }, { quoted: msg })

        const timestamp = Date.now()
        const backupName = `database_backup_${timestamp}.zip`
        const backupPath = path.join(BACKUP_DIR, backupName)

        try {
            const output = fs.createWriteStream(backupPath)
            const archive = archiver('zip', { zlib: { level: 9 } })

            output.on('close', async () => {
                const stats = fs.statSync(backupPath)
                const sizeMB = (stats.size / 1024 / 1024).toFixed(2)

                await sock.sendMessage(from, {
                    document: fs.readFileSync(backupPath),
                    mimetype: 'application/zip',
                    fileName: backupName,
                    caption: `> ✅ *Copia de seguridad*\n\n> 📅 Fecha: ${new Date().toLocaleString('es-HN')}\n> 📦 Tamaño: ${sizeMB} MB\n> 🍃 Base de datos comprimida`
                }, { quoted: msg })

                fs.unlinkSync(backupPath)
                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
            })

            archive.on('error', (err) => {
                throw err
            })

            archive.pipe(output)
            archive.file(DATABASE_PATH, { name: 'database.json' })
            await archive.finalize()

        } catch (err) {
            console.error(err)
            await sock.sendMessage(from, { text: '> ❌ Error al crear la copia de seguridad.' }, { quoted: msg })
        }
    }
}