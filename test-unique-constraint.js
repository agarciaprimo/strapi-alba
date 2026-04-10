#!/usr/bin/env node

const https = require('https');

function fetchAPI(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...opts.headers }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(JSON.stringify(opts.body));
    req.end();
  });
}

(async () => {
  const token = 'bbe7d8e65e614b6c9f39429189242798a8d8bfb2b49f3418d1dee2d5dcf596bb57f9fc67ca373387f2e156e61f7a68920763f1a357fbb0affdef05279f82d5f837e0e2fee0c8871bcd110ef675c9a96f8e254524f1e3ff3cfb736873f3ea340b0568dbafe36a861740deb30fe38e74509dcf517eccb8157de185c912142534a9';

  console.log('Probando qué campo tiene restricción de unicidad...\n');

  const rando = Math.random().toString(36).substring(7);
  const r = await fetchAPI('https://strapi-alba.onrender.com/api/articles', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: {
      data: {
        titulo: 'TEST TITLE ' + rando,
        slug: 'test-slug-' + rando,
        content: 'test content',
        excerp: 'test excerpt',
        fecha: '2026-03-23'
      }
    }
  });

  console.log('Status:', r.status);
  if (r.data?.error?.details?.errors) {
    console.log('\nErrores de validación:');
    r.data.error.details.errors.forEach(e => {
      console.log(`  - Campo: ${e.path.join('.')}`);
      console.log(`    Error: ${e.message}`);
      console.log(`    Valor: ${e.value}`);
    });
  } else if (r.status === 201) {
    console.log('\n✓ ¡Artículo creado exitosamente!');
    console.log('Respuesta:', JSON.stringify(r.data.data, null, 2).substring(0, 300));
  } else {
    console.log('\nRespuesta completa:', JSON.stringify(r.data, null, 2));
  }
})();
