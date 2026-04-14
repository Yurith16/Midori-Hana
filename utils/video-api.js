import axios from 'axios'
import fg from 'fg-senna'

// ─── SCRAPER: ytmp3.gs (primer método) ────────────────────

const _sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const _ts = () => Math.floor(Date.now() / 1000)

function _extractJsonArray(html) {
  const match = html.match(/var json = JSON\.parse\('(\[.*?\])'\);/)
  if (!match) throw new Error('No se pudo obtener la autenticación')
  return JSON.parse(match[1])
}

function _generateAuth(jsonArray) {
  let e = ''
  for (let t = 0; t < jsonArray[0].length; t++) {
    e += String.fromCharCode(jsonArray[0][t] - jsonArray[2][jsonArray[2].length - (t + 1)])
  }
  if (jsonArray[1]) e = e.split('').reverse().join('')
  return e.length > 32 ? e.substring(0, 32) : e
}

function _extractVideoId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)
  if (!match) throw new Error('URL de YouTube inválida')
  return match[1]
}

export async function getVideoYtmp3gs(url) {
  const videoId = _extractVideoId(url)

  const res1 = await fetch('https://ytmp3.gs/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  })
  const html = await res1.text()
  const jsonArray = _extractJsonArray(html)
  const authKey = _generateAuth(jsonArray)
  const paramName = String.fromCharCode(jsonArray[6])

  const initUrl = `https://epsilon.epsiloncloud.org/api/v1/init?${paramName}=${encodeURIComponent(authKey)}&t=${_ts()}`
  const res2 = await fetch(initUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://ytmp3.gs/',
      'Origin': 'https://ytmp3.gs'
    }
  })
  if (!res2.ok) throw new Error(`HTTP Error init: ${res2.status}`)
  const initData = JSON.parse(await res2.text())
  if (initData.error && Number(initData.error) > 0) throw new Error(`Init error (${initData.error})`)

  let convertUrl = initData.convertURL
  if (!convertUrl) throw new Error('No se obtuvo URL de conversión')

  let downloadData = null
  while (true) {
    const cData = await (await fetch(`${convertUrl}&v=${videoId}&f=mp4&t=${_ts()}`)).json()
    if (cData.error && Number(cData.error) > 0) throw new Error(`Convert error (${cData.error})`)
    if (cData.redirect === 1 && cData.redirectURL) { convertUrl = cData.redirectURL; continue }
    downloadData = cData
    break
  }

  let { progressURL, downloadURL, title = 'video' } = downloadData
  let completed = false
  let retries = 0

  while (!completed && retries < 30) {
    const pData = await (await fetch(`${progressURL}&t=${_ts()}`)).json()
    if (pData.error && Number(pData.error) > 0) throw new Error(`Progress error (${pData.error})`)
    if (pData.title) title = pData.title
    if (pData.progress === 3) { completed = true; break }
    await _sleep(3000)
    retries++
  }

  if (!completed) throw new Error('Tiempo de espera agotado')

  return {
    url: `${downloadURL}&s=2&v=${videoId}&f=mp4`,
    title,
    thumb: null,
    quality: '360p'
  }
}

// ─── API: FG-Senna (segundo método) ──────────────────────

export async function getVideoFgSenna(url) {
  const qualities = ['360p', '480p', '720p', '240p', '144p']
  for (const q of qualities) {
    try {
      const res = await fg.ytv(url, q)
      if (res && res.dl_url) {
        return {
          url: res.dl_url,
          title: res.title,
          thumb: res.thumb,
          quality: q,
          needsDownload: true
        }
      }
    } catch {}
  }
  throw new Error('FG-Senna falló')
}

// ─── API: Sylphy ──────────────────────────────────────────

export async function getVideoSylphy(url) {
  const res = await axios.get(`https://sylphy.xyz/download/ytmp4?url=${encodeURIComponent(url)}&api_key=sylphy-olYb0wj`, { timeout: 30000 })
  if (res.data?.status && res.data?.result?.dl_url) {
    return {
      url: res.data.result.dl_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail || res.data.result.thumb,
      quality: res.data.result.quality || '360p'
    }
  }
  throw new Error('Sylphy falló')
}

// ─── API: EliteProTech ────────────────────────────────────

export async function getVideoEliteProTech(url) {
  const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp4`, { timeout: 30000 })
  if (res.data?.success && res.data?.downloadURL) {
    return {
      url: res.data.downloadURL,
      title: res.data.title,
      thumb: res.data.thumbnail,
      quality: '360p'
    }
  }
  throw new Error('EliteProTech falló')
}

// ─── API: Yupra ───────────────────────────────────────────

export async function getVideoYupra(url) {
  const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.data?.download_url) {
    return {
      url: res.data.data.download_url,
      title: res.data.data.title,
      thumb: res.data.data.thumbnail,
      quality: '360p'
    }
  }
  throw new Error('Yupra falló')
}

// ─── API: Okatsu ──────────────────────────────────────────

export async function getVideoOkatsu(url) {
  const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.result?.mp4) {
    return {
      url: res.data.result.mp4,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail,
      quality: '360p'
    }
  }
  throw new Error('Okatsu falló')
}

// ─── Lista de APIs en orden de prioridad ──────────────────

export const videoApis = [
  { name: 'ytmp3.gs scraper', get: getVideoYtmp3gs      },
  { name: 'FG-Senna',         get: getVideoFgSenna      },
  { name: 'Sylphy',           get: getVideoSylphy       },
  { name: 'EliteProTech',     get: getVideoEliteProTech },
  { name: 'Yupra',            get: getVideoYupra        },
  { name: 'Okatsu',           get: getVideoOkatsu       }
]

// ─── Función principal ────────────────────────────────────

export async function getVideo(url) {
  for (const api of videoApis) {
    try {
      const result = await api.get(url)
      console.log(`🎬 ${api.name} OK`)
      return result
    } catch (err) {
      console.log(`❌ ${api.name} fail`)
    }
  }
  throw new Error('Todas las APIs fallaron')
}