import axios from 'axios'
import fg from 'fg-senna'

// ─── API: Apinexus (primera opción) ───────────────────────

export async function getAudioApinexus(url) {
  const response = await fetch('https://panel.apinexus.fun/api/youtube/v2/mp3', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'x-api-key': 'antbx21e5jhac' 
    },
    body: JSON.stringify({ url })
  })

  const res = await response.json()

  if (res && res.success && res.data?.audio) {
    return {
      url: res.data.audio,
      title: res.data.titulo,
      thumb: null
    }
  }
  throw new Error('Apinexus falló')
}

// ─── SCRAPER: ytmp3.gs ────────────────────────────────────

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

export async function getAudioYtmp3gs(url) {
  const videoId = _extractVideoId(url)

  const res1 = await fetch('https://ytmp3.gs/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  })
  const html = await res1.text()
  const jsonArray = _extractJsonArray(html)
  const authKey = _generateAuth(jsonArray)
  const paramName = String.fromCharCode(jsonArray[6])

  const initUrl = `https://epsilon.epsiloncloud.org/api/v1/init?${paramName}=${encodeURIComponent(authKey)}&t=${_ts()}`
  const initData = await (await fetch(initUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://ytmp3.gs/',
      'Origin': 'https://ytmp3.gs'
    }
  })).json()

  if (initData.error && Number(initData.error) > 0) throw new Error(`Init error (${initData.error})`)

  let convertUrl = initData.convertURL
  if (!convertUrl) throw new Error('No se obtuvo URL de conversión')

  let downloadData = null
  while (true) {
    const cData = await (await fetch(`${convertUrl}&v=${videoId}&f=mp3&t=${_ts()}`)).json()
    if (cData.error && Number(cData.error) > 0) throw new Error(`Convert error (${cData.error})`)
    if (cData.redirect === 1 && cData.redirectURL) { convertUrl = cData.redirectURL; continue }
    downloadData = cData
    break
  }

  let { progressURL, downloadURL, title = 'audio' } = downloadData
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
    url: `${downloadURL}&s=2&v=${videoId}&f=mp3`,
    title,
    thumb: null
  }
}

// ─── API: PrinceTech yta ───────────────────────────────────

export async function getAudioPrinceYta(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/yta?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.download_url) {
    return {
      url: res.data.result.download_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech yta falló')
}

// ─── API: PrinceTech ytmp3 ─────────────────────────────────

export async function getAudioPrinceYtmp3(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/ytmp3?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.download_url) {
    return {
      url: res.data.result.download_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech ytmp3 falló')
}

// ─── API: PrinceTech ytdl ──────────────────────────────────

export async function getAudioPrinceYtdl(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/ytdl?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.audio_url) {
    return {
      url: res.data.result.audio_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech ytdl falló')
}

// ─── API: PrinceTech ytdlv2 ───────────────────────────────

export async function getAudioPrinceYtdlv2(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/ytdlv2?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.audio_url) {
    return {
      url: res.data.result.audio_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech ytdlv2 falló')
}

// ─── API: PrinceTech dlmp3 ────────────────────────────────

export async function getAudioPrinceDlmp3(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/dlmp3?apikey=prince&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.download_url) {
    return {
      url: res.data.result.download_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech dlmp3 falló')
}

// ─── API: PrinceTech ytmusic ──────────────────────────────

export async function getAudioPrinceYtmusic(url) {
  const res = await axios.get(`https://api.princetechn.com/api/download/ytmusic?apikey=prince&quality=mp3&url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.result?.download_url) {
    return {
      url: res.data.result.download_url,
      title: res.data.result.title,
      thumb: res.data.result.thumbnail
    }
  }
  throw new Error('PrinceTech ytmusic falló')
}

// ─── API: Delirius v1 ─────────────────────────────────────

export async function getAudioDeliriusV1(url) {
  const res = await axios.get(`https://api.delirius.store/download/ytmp3?url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.status && res.data?.data?.download) {
    return {
      url: res.data.data.download,
      title: res.data.data.title,
      thumb: res.data.data.image
    }
  }
  throw new Error('Delirius v1 falló')
}

// ─── API: Delirius v2 ─────────────────────────────────────

export async function getAudioDeliriusV2(url) {
  const res = await axios.get(`https://api.delirius.store/download/ytmp3v2?url=${encodeURIComponent(url)}`, { timeout: 30000 })
  if (res.data?.success && res.data?.data?.download) {
    return {
      url: res.data.data.download,
      title: res.data.data.title,
      thumb: null
    }
  }
  throw new Error('Delirius v2 falló')
}

// ─── API: Sylphy v2 ───────────────────────────────────────

export async function getAudioSylphy(url) {
  const cleanUrl = url.split('?')[0]
  const res = await axios.get(`https://sylphy.xyz/download/v2/ytmp3?url=${encodeURIComponent(cleanUrl)}&api_key=sylphy-olYb0wj`, { timeout: 30000 })
  if (res.data?.status && res.data?.result?.dl_url) {
    return {
      url: res.data.result.dl_url,
      title: res.data.result.title,
      thumb: null
    }
  }
  throw new Error('Sylphy falló')
}

// ─── API: FG-Senna (fallback) ─────────────────────────────

export async function getAudioFgSenna(url) {
  const res = await fg.yta(url)
  if (res && res.dl_url) {
    return {
      url: res.dl_url,
      title: res.title,
      thumb: res.thumb,
      needsConversion: true
    }
  }
  throw new Error('FG-Senna falló')
}

// ─── Lista de APIs en orden de prioridad ──────────────────

export const audioApis = [
  { name: 'Apinexus',           get: getAudioApinexus      },
  { name: 'ytmp3.gs scraper',   get: getAudioYtmp3gs      },
  { name: 'PrinceTech yta',     get: getAudioPrinceYta    },
  { name: 'PrinceTech ytmp3',   get: getAudioPrinceYtmp3  },
  { name: 'PrinceTech ytdl',    get: getAudioPrinceYtdl   },
  { name: 'PrinceTech ytdlv2',  get: getAudioPrinceYtdlv2 },
  { name: 'PrinceTech dlmp3',   get: getAudioPrinceDlmp3  },
  { name: 'PrinceTech ytmusic', get: getAudioPrinceYtmusic},
  { name: 'Delirius v1',        get: getAudioDeliriusV1   },
  { name: 'Delirius v2',        get: getAudioDeliriusV2   },
  { name: 'Sylphy',             get: getAudioSylphy       },
  { name: 'FG-Senna',           get: getAudioFgSenna      }
]

// ─── Función principal ────────────────────────────────────

export async function getAudio(url) {
  for (const api of audioApis) {
    try {
      const result = await api.get(url)
      console.log(`🎵 ${api.name} OK`)
      return result
    } catch (err) {
      console.log(`❌ ${api.name} fail`)
    }
  }
  throw new Error('Todas las APIs fallaron')
}