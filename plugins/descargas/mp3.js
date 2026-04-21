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
  console.log(`✅ [MP3] Usando yt-dlp LOCAL en: ${ytDlpPath}`);
} else {
  console.log(`⚠️ [MP3] No se encontró yt-dlp local, usando el del sistema`);
}

export default {
  command: ['mp3'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    if (!args[0]) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } });
      await sock.sendMessage(from, { text: '> ¿Qué audio deseas descargar bb? 🍃' }, { quoted: msg });
      return;
    }

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } });

    try {
      let url = args[0];
      let audioTitle = '';
      let audioAuthor = '';
      let audioThumb = '';
      let duration = 0;

      // Si no es URL, buscar en YouTube
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        const searchQuery = args.join(' ');
        const searchResult = await yts(searchQuery);

        if (!searchResult.videos.length) throw new Error('No se encontraron resultados');

        const video = searchResult.videos[0];
        url = video.url;
        audioTitle = video.title;
        audioAuthor = video.author.name;
        audioThumb = video.thumbnail;
        duration = video.seconds;
      } else {
        // Es URL directa, obtener información con yt-dlp LOCAL con opciones mejoradas
        const userAgent = getRandomUserAgent();
        const infoCommand = `"${ytDlpPath}" --dump-json --extractor-args "youtube:player-client=web,default" --user-agent "${userAgent}" "${url}"`;
        const { stdout: infoStdout } = await execPromise(infoCommand, { timeout: 30000 });
        const videoInfo = JSON.parse(infoStdout);
        audioTitle = videoInfo.title;
        audioAuthor = videoInfo.uploader;
        audioThumb = videoInfo.thumbnail;
        duration = videoInfo.duration;
      }

      // Verificar límite de 1 hora (3600 segundos)
      if (duration > 3600) {
        throw new Error('El audio dura más de 1 hora');
      }

      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } });

      const outputDir = './temp_audios/';
      await fs.mkdir(outputDir, { recursive: true });

      // Descargar usando yt-dlp LOCAL con opciones anti-bloqueo
      const userAgent = getRandomUserAgent();
      const command = `"${ytDlpPath}" -f "bestaudio" --extract-audio --audio-format mp3 --audio-quality 0 --restrict-filenames --extractor-args "youtube:player-client=web,default" --user-agent "${userAgent}" --sleep-interval 2 --max-sleep-interval 5 --no-check-certificate -o "${outputDir}%(title)s.%(ext)s" "${url}"`;

      await execPromise(command, { timeout: 240000 });

      const files = await fs.readdir(outputDir);
      const audioFile = files.find(f => f.endsWith('.mp3'));

      if (!audioFile) throw new Error('No se encontró el audio');

      const fullPath = path.join(outputDir, audioFile);
      const audioBuffer = await fs.readFile(fullPath);

      await sock.sendMessage(from, { react: { text: '📤', key: msg.key } });

      // Enviar como documento con el mismo diseño
      const fileName = `${audioTitle.replace(/[<>:"/\\|?*]/g, '').substring(0, 100)}.mp3`;

      const sentMsg = await sock.sendMessage(from, {
        document: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: fileName,
        contextInfo: {
          externalAdReply: {
            title: audioTitle.substring(0, 50),
            body: audioAuthor,
            thumbnailUrl: audioThumb || 'https://i.imgur.com/8g9QRs6.png',
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
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } });
    }
  }
};