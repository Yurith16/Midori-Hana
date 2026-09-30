// test.js
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const API_KEY = 'b69e9ac84c9c5f8a9f265c337a9005f3'
const AUTH_URL = 'https://gamma.gammacloud.net/api/v1/auth'
const INIT_URL = 'https://gamma.gammacloud.net/api/v1/init'
const MAX_INTENTOS_PROGRESS = 60
const DELAY_PROGRESS_MS = 2000

async function fetchConReintentos(url, opciones = {}, intentos = 3) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const res = await fetch(url, opciones)
      if (res.ok) return res
      console.log(`[fetch] intento ${i} status ${res.status}`)
    } catch (e) {
      console.log(`[fetch] intento ${i} error:`, e.message)
    }
    if (i < intentos) await new Promise(r => setTimeout(r, 1500 * i))
  }
  return null
}

function headersBase(referer = 'https://ytmp3.gl/') {
  return {
    'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    'accept': '*/*',
    'accept-language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    'referer': referer,
    'origin': 'https://ytmp3.gl'
  }
}

async function main() {
  const rl = readline.createInterface({ input, output })

  const entrada = await rl.question('URL o ID de YouTube [default: vWtJJRTqVSI]: ')
  const idInput = entrada.trim() || 'https://www.youtube.com/watch?v=vWtJJRTqVSI'

  const ytRegex = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  const match = idInput.match(ytRegex)
  const videoId = match ? match[1] : idInput.trim()

  console.log('Video ID:', videoId)

  console.log('\n[1/6] auth...')
  const authRes = await fetchConReintentos(`${AUTH_URL}?api_key=${API_KEY}&_=${Date.now()}`, {
    headers: headersBase()
  })
  const authData = authRes ? await authRes.json() : null
  console.log('respuesta:', authData)

  if (!authData?.key) {
    console.log('Sin key.')
    rl.close()
    return
  }

  console.log('\n[2/6] init...')
  const initRes = await fetchConReintentos(`${INIT_URL}?_=${Date.now()}`, {
    headers: { ...headersBase(), 'authorization': `Bearer ${authData.key}` }
  })
  const initData = initRes ? await initRes.json() : null
  console.log('convertURL base:', initData?.convertURL ? 'ok' : 'falta')

  if (!initData?.convertURL) {
    console.log('Sin convertURL.')
    rl.close()
    return
  }

  const primeraConvertUrl = `${initData.convertURL}&v=${videoId}&f=mp4&_=${Date.now()}`
  console.log('\n[3/6] convert (1)...')
  const conv1Res = await fetchConReintentos(primeraConvertUrl, {
    headers: headersBase()
  })
  const conv1Data = conv1Res ? await conv1Res.json() : null

  let downloadURL = conv1Data?.downloadURL
  let progressURL = conv1Data?.progressURL
  let titulo = conv1Data?.title || ''

  if (!downloadURL && conv1Data?.redirectURL) {
    const segundaUrl = conv1Data.redirectURL.includes('_=')
      ? conv1Data.redirectURL
      : `${conv1Data.redirectURL}&_=${Date.now()}`

    console.log('\n[4/6] convert (2 — redirect)...')
    const conv2Res = await fetchConReintentos(segundaUrl, {
      headers: headersBase()
    })
    const conv2Data = conv2Res ? await conv2Res.json() : null

    downloadURL = conv2Data?.downloadURL
    progressURL = conv2Data?.progressURL
    titulo = conv2Data?.title || titulo
  }

  // Polling: esperar a progress === 3
  if (progressURL) {
    console.log('\n[5/6] esperando conversión (hasta progress=3)...')

    for (let i = 1; i <= MAX_INTENTOS_PROGRESS; i++) {
      await new Promise(r => setTimeout(r, DELAY_PROGRESS_MS))

      const progUrl = progressURL.includes('_=')
        ? progressURL
        : `${progressURL}&_=${Date.now()}`

      const progRes = await fetchConReintentos(progUrl, { headers: headersBase() })
      if (!progRes) continue

      const progData = await progRes.json().catch(() => null)
      console.log(`  intento ${i}:`, progData)

      if (progData?.title) titulo = progData.title

      if (progData?.progress === 3) {
        console.log('  → listo')
        break
      }
    }
  }

  if (!downloadURL) {
    console.log('Sin downloadURL final.')
    rl.close()
    return
  }

  if (!titulo) titulo = 'video'

  console.log('\n[6/6] descargando...')

  // Aseguramos que la URL tenga &r=ytmp3.gl
  const finalUrl = downloadURL.includes('r=ytmp3.gl')
    ? downloadURL
    : `${downloadURL}&r=ytmp3.gl`

  const dlRes = await fetchConReintentos(finalUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'referer': 'https://ytmp3.gl/'
    },
    redirect: 'follow'
  })

  if (!dlRes) {
    console.log('Falló la descarga.')
    rl.close()
    return
  }

  console.log('Status:', dlRes.status)
  console.log('Content-Type:', dlRes.headers.get('content-type'))
  console.log('Content-Length:', dlRes.headers.get('content-length'))

  const buf = Buffer.from(await dlRes.arrayBuffer())
  console.log(`Buffer recibido: ${buf.length} bytes`)
  console.log('Título:', titulo)

  rl.close()
}

main().catch(e => {
  console.error('Error general:', e)
  process.exit(1)
})