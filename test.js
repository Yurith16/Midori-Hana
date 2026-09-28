// test.js

const apiKey = 'lem_c92ba8f5ed716cd9d1ba968623728690dc706dcb';
const videoUrl = 'https://youtu.be/rO1VejkWBJg';

const api = `https://api.lempi.lat/dl/yta?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`;
const res = await fetch(api, { headers: { 'content-type': 'application/json' } });
const data = await res.json();

console.log('URL inicial:', data.datos.url);

let url = data.datos.url;
for (let i = 0; i < 6; i++) {
  const r = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    },
  });

  console.log(`\n[${i}] ${url.slice(0, 100)}`);
  console.log('    status:', r.status);
  console.log('    location:', r.headers.get('location'));
  console.log('    content-type:', r.headers.get('content-type'));

  const loc = r.headers.get('location');
  if (!loc) {
    const buf = Buffer.from(await r.arrayBuffer());
    console.log('    bytes:', buf.length);
    console.log('    preview:', buf.slice(0, 200).toString('utf8').replace(/\n/g, ' '));
    break;
  }
  url = new URL(loc, url).toString();
}