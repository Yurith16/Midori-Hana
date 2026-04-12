import axios from 'axios'

// Sesiones activas: userId -> { apps, timeout, from, msg }
const sesiones = new Map()

function parseMB(tamaño) {
  if (!tamaño) return 0
  const num = parseFloat(tamaño)
  if (tamaño.includes('GB')) return num * 1024
  return num // ya está en MB
}

export default {
  command: ['apk'],
  group: false,
  owner: false,

  async execute(sock, msg, { args, from }) {
    const userId = msg.key.participant || from
    const text = args.join(' ').trim()

    // — Flujo de selección: usuario responde con número —
    if (sesiones.has(userId) && /^[1-5]$/.test(text)) {
      const sesion = sesiones.get(userId)
      clearTimeout(sesion.timeout)
      sesiones.delete(userId)

      const idx = parseInt(text) - 1
      const app = sesion.apps[idx]
      if (!app) {
        await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
        await sock.sendMessage(from, { text: '> Opción no válida 🍃' }, { quoted: msg })
        return
      }

      const mb = parseMB(app.tamaño)
      if (mb > 400) {
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        await sock.sendMessage(from, { text: `> Esta app pesa *${app.tamaño}* — no está permitido descargar archivos tan pesados 🍃` }, { quoted: msg })
        return
      }

      await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

      try {
        const response = await axios.get(app.url_descarga_directa, {
          responseType: 'arraybuffer',
          timeout: 60000
        })

        const buffer = Buffer.from(response.data)
        const fileName = `${app.titulo.replace(/[^a-zA-Z0-9]/g, '_')}.apk`

        await sock.sendMessage(from, {
          document: buffer,
          mimetype: 'application/vnd.android.package-archive',
          fileName,
          caption: `> Aquí tiene su APK @${userId.split('@')[0]} 🍃\n> *${app.titulo}* v${app.version} — ${app.tamaño}`,
          mentions: [userId]
        }, { quoted: sesion.msg })

        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      } catch (err) {
        console.error(err)
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        await sock.sendMessage(from, { text: '> No se pudo descargar la aplicación 🍃' }, { quoted: msg })
      }
      return
    }

    // — Flujo de búsqueda —
    if (!text) {
      await sock.sendMessage(from, { react: { text: '🫢', key: msg.key } })
      await sock.sendMessage(from, { text: '> ¿Qué aplicación quieres descargar? 🍃' }, { quoted: msg })
      return
    }

    await sock.sendMessage(from, { react: { text: '🔍', key: msg.key } })

    try {
      const { data } = await axios.get(`https://api.adoolab.xyz/search/uptodown?q=${encodeURIComponent(text)}&limit=5`, {
        timeout: 15000
      })

      if (!data.status || !data.resultados?.length) {
        throw new Error('Sin resultados')
      }

      const apps = data.resultados.slice(0, 5)

      let menu = `> 🤖 *Resultados para:* ${text} 🍃\n\n`
      apps.forEach((app, i) => {
        menu += `*${i + 1}.* ${app.titulo}\n`
        menu += `> 👤 ${app.desarrollador}\n`
        menu += `> 📦 ${app.tamaño} — v${app.version}\n\n`
      })
      menu += `> Responde con el número de la opción que deseas descargar\n>Ejemplo: .apk 1\n>> Tienes *2 minutos* para elegir 🍃`

      // Guardar sesión con timeout de 2 minutos
      const timeout = setTimeout(async () => {
        if (sesiones.has(userId)) {
          sesiones.delete(userId)
          await sock.sendMessage(from, { text: '> Tiempo agotado, vuelve a buscar cuando quieras 🍃' }, { quoted: msg })
        }
      }, 2 * 60 * 1000)

      sesiones.set(userId, { apps, timeout, from, msg })

      const sentMsg = await sock.sendMessage(from, { text: menu }, { quoted: msg })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (err) {
      console.error(err)
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      await sock.sendMessage(from, { text: '> No se encontraron resultados 🍃' }, { quoted: msg })
    }
  }
}