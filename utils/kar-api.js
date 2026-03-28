import axios from 'axios'
import fg from 'fg-senna'

// API: PrinceTech yta
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

// API: PrinceTech ytmp3
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

// API: PrinceTech ytdl
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

// API: PrinceTech ytdlv2
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

// API: PrinceTech dlmp3
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

// API: PrinceTech ytmusic
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

// API: Delirius v1
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

// API: Delirius v2
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

// API: Sylphy v2
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

// API: FG-Senna (fallback con conversión)
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

// Lista de APIs en orden de prioridad
export const audioApis = [
  { name: 'PrinceTech yta', get: getAudioPrinceYta },
  { name: 'PrinceTech ytmp3', get: getAudioPrinceYtmp3 },
  { name: 'PrinceTech ytdl', get: getAudioPrinceYtdl },
  { name: 'PrinceTech ytdlv2', get: getAudioPrinceYtdlv2 },
  { name: 'PrinceTech dlmp3', get: getAudioPrinceDlmp3 },
  { name: 'PrinceTech ytmusic', get: getAudioPrinceYtmusic },
  { name: 'Delirius v1', get: getAudioDeliriusV1 },
  { name: 'Delirius v2', get: getAudioDeliriusV2 },
  { name: 'Sylphy', get: getAudioSylphy },
  { name: 'FG-Senna', get: getAudioFgSenna }
]

// Función principal para obtener audio
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