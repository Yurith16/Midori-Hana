import axios from 'axios'
import fg from 'fg-senna'

// API: Sylphy (la de tu amigo)
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

// API: EliteProTech
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

// API: Yupra
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

// API: Okatsu
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

// API: FG-Senna (fallback)
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
    } catch (err) {}
  }
  throw new Error('FG-Senna falló')
}

// LISTA DE APIs (Sylphy como primera opción)
export const videoApis = [
  { name: 'Sylphy', get: getVideoSylphy },      // ← Nueva API de tu amigo
  { name: 'EliteProTech', get: getVideoEliteProTech },
  { name: 'Yupra', get: getVideoYupra },
  { name: 'Okatsu', get: getVideoOkatsu },
  { name: 'FG-Senna', get: getVideoFgSenna }
]

// Función principal para obtener video
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