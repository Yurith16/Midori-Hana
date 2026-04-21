import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import yts from 'yt-search';
import config from '../../config.js';

const execPromise = promisify(exec);

// Ruta local de yt-dlp
const ytDlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');

// User-Agents rotativos para evitar detección
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Obtener User-Agent aleatorio
const getRandomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

// Verificar si existe el archivo local al cargar el plugin (solo en consola)
if (fsSync.existsSync(ytDlpPath)) {
  console.log(`✅ [MP4] Usando yt-dlp LOCAL en: ${ytDlpPath}`);
} else {
  console.log(`⚠️ [MP4] No se encontró yt-dlp local, usando el del sistema`);
}

// Control de descargas por usuario
const userDownloads = new Map();

export default {
  command: ['mp4'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from, sender }) {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } });
      await sock.sendMessage(from, { text: '> ¿Qué video deseas descargar bb? 🍃' }, { quoted: msg });
      return;
    }

    // Verificar si el usuario ya está descargando
    if (userDownloads.has(sender)) {
      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });
      return;
    }

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });

    try {
      let url = args[0];
      let videoTitle = '';
      let videoAuthor = '';
      let videoThumb = '';
      let fileSizeMB = 0;

      // Si no es URL, buscar en YouTube
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        const searchQuery = args.join(' ');
        const searchResult = await yts(searchQuery);

        if (!searchResult.videos.length) throw new Error('No se encontraron resultados');

        const video = searchResult.videos[0];
        url = video.url;
        videoTitle = video.title;
        videoAuthor = video.author.name;
        videoThumb = video.thumbnail;
        fileSizeMB = (video.seconds * 0.5) / 1024; // Estimación aproximada
      } else {
        // Es URL directa, obtener información con yt-dlp LOCAL con opciones mejoradas
        const userAgent = getRandomUserAgent();
        const infoCommand = `"${ytDlpPath}" --dump-json --extractor-args "youtube:player-client=web,default" --user-agent "${userAgent}" "${url}"`;
        const { stdout: infoStdout } = await execPromise(infoCommand, { timeout: 30000 });
        const videoInfo = JSON.parse(infoStdout);
        videoTitle = videoInfo.title;
        videoAuthor = videoInfo.uploader;
        videoThumb = videoInfo.thumbnail;
        const fileSizeBytes = videoInfo.filesize || 0;
        fileSizeMB = fileSizeBytes / (1024 * 1024);
      }

      // Verificar límite de 500MB
      if (fileSizeMB > 500) {
        throw new Error('El video pesa más de 500MB');
      }

      // Marcar que el usuario está descargando
      userDownloads.set(sender, Date.now());
      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

      const outputDir = './temp_videos/';
      await fs.mkdir(outputDir, { recursive: true });

      // Descargar usando yt-dlp LOCAL con opciones anti-bloqueo
      const userAgent = getRandomUserAgent();
      const command = `"${ytDlpPath}" -f "best[ext=mp4]" --restrict-filenames --extractor-args "youtube:player-client=web,default" --user-agent "${userAgent}" --sleep-interval 2 --max-sleep-interval 5 --no-check-certificate -o "${outputDir}%(title)s.%(ext)s" "${url}"`;

      await execPromise(command, { timeout: 240000 });

      const files = await fs.readdir(outputDir);
      const videoFile = files.find(f => f.endsWith('.mp4'));

      if (!videoFile) throw new Error('No se encontró el video');

      const fullPath = path.join(outputDir, videoFile);
      const videoBuffer = await fs.readFile(fullPath);

      await sock.sendMessage(from, { react: { text: '📤', key: msg.key } });

      // Enviar como documento con el diseño solicitado
      const fileName = `${videoTitle.replace(/[<>:"/\\|?*]/g, '').substring(0, 100)}.mp4`;

      const sentMsg = await sock.sendMessage(from, {
        document: videoBuffer,
        mimetype: 'video/mp4',
        fileName: fileName,
        contextInfo: {
          externalAdReply: {
            title: videoTitle.substring(0, 50),
            body: videoAuthor,
            thumbnailUrl: videoThumb || 'https://i.imgur.com/8g9QRs6.png',
            sourceUrl: url,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });

      if (sentMsg) {
        await sock.sendMessage(from, { react: { text: '🍃', key: sentMsg.key } });
      }

      await fs.unlink(fullPath).catch(() => {});

      // Liberar al usuario y éxito
      userDownloads.delete(sender);
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error(err);
      // Liberar al usuario en caso de error
      userDownloads.delete(sender);
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } });
    }
  }
};