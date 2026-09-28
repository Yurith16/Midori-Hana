// test.js
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const BASE = 'https://spotsaver.net'
const COOKIE = '__cf_bm=qW81c27w3CxcwM3bq4KFOAGzNI44hiPXfYAsVYo9pZw-1790612006.501612-1.0.1.1-5jlDVeWIRgrdq7.ne1mLUJdVtAKVZVh0p6kapLTiHhGPAQQygb197VTF4KyE0ne.PPuSut2dtx3Wy4LS7fGNHCf6hMQWw75x73Fz8mK_J3FxXK4aqLv.S8dUWCwNkIBD'

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

async function main() {
  const rl = readline.createInterface({ input, output })

  const headersBase = {
    'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
    'accept': '*/*',
    'accept-language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    'referer': BASE + '/results/',
    'origin': BASE,
    'cookie': COOKIE
  }

  const query = await rl.question('Buscar: ')
  if (!query.trim()) {
    console.log('Búsqueda vacía.')
    rl.close()
    return
  }

  console.log('\nBuscando...')
  const searchRes = await fetchConReintentos(
    `${BASE}/api/spotify/?q=${encodeURIComponent(query)}`,
    { headers: headersBase }
  )
  if (!searchRes) {
    console.log('Falló la búsqueda.')
    rl.close()
    return
  }

  const searchData = await searchRes.json()
  console.log('Claves de respuesta:', Object.keys(searchData))

  const resultados =
    searchData?.items ||
    searchData?.results ||
    searchData?.tracks ||
    searchData?.canciones ||
    (Array.isArray(searchData) ? searchData : null)

  if (!resultados || !resultados.length) {
    console.log('No encontré resultados. Estructura:')
    console.log(JSON.stringify(searchData, null, 2).slice(0, 800))
    rl.close()
    return
  }

  resultados.slice(0, 10).forEach((r, i) => {
    const t = r.title || r.titulo || r.name || '?'
    const a = r.artist || r.artista || (r.artists?.[0]?.name) || ''
    console.log(`${i + 1}. ${t}${a ? ' - ' + a : ''}`)
  })

  const sel = await rl.question('\nElige número (1-10): ')
  const idx = parseInt(sel) - 1
  const elegido = resultados[idx]
  if (!elegido) {
    console.log('Selección inválida.')
    rl.close()
    return
  }

  const titulo = elegido.title || elegido.titulo || elegido.name
  const artista = elegido.artist || elegido.artista || (elegido.artists?.[0]?.name) || ''
  console.log(`\nElegido: ${titulo} - ${artista}`)

  console.log('\nObteniendo videoId...')
  const idRes = await fetchConReintentos(`${BASE}/api/get-id/`, {
    method: 'POST',
    headers: { ...headersBase, 'content-type': 'application/json' },
    body: JSON.stringify({ title: titulo, artist: artista })
  })
  if (!idRes) {
    console.log('Falló get-id.')
    rl.close()
    return
  }
  const idData = await idRes.json()
  console.log('get-id:', idData)
  const videoId = idData?.videoId
  if (!videoId) {
    console.log('Sin videoId.')
    rl.close()
    return
  }

  console.log('\nSolicitando descarga...')
  const dlRes = await fetchConReintentos(`${BASE}/api/download/`, {
    method: 'POST',
    headers: { ...headersBase, 'content-type': 'application/json' },
    body: JSON.stringify({
      videoId,
      candidateIds: [],
      format: 'mp3',
      title: `${titulo} - ${artista}`,
      licenseKey: null
    })
  })
  if (!dlRes) {
    console.log('Falló download.')
    rl.close()
    return
  }
  const dlData = await dlRes.json()
  console.log('download:', dlData)

  const mediaUrl = dlData?.mediaUrl || dlData?.url || dlData?.downloadUrl
  if (!mediaUrl) {
    console.log('Sin URL de audio.')
    rl.close()
    return
  }

  console.log('\nDescargando buffer...')
  const audioRes = await fetchConReintentos(mediaUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'referer': BASE + '/',
      'cookie': COOKIE
    },
    redirect: 'follow'
  })
  if (!audioRes) {
    console.log('Falló la descarga del audio.')
    rl.close()
    return
  }

  const buf = Buffer.from(await audioRes.arrayBuffer())
  console.log(`Buffer recibido: ${buf.length} bytes`)
  console.log('Content-Type:', audioRes.headers.get('content-type'))

  rl.close()
}

main().catch(e => {
  console.error('Error general:', e)
  process.exit(1)
})