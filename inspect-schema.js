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

  console.log('Inspección de schema remoto...\n');

  // Intentar obtener el schema de content type
  const r = await fetchAPI('https://strapi-alba.onrender.com/api/content-type-builder/content-types', {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  if (r.status === 200 && r.data?.data) {
    const article = r.data.data.find(ct => ct.uid === 'api::article.article');
    if (article) {
      console.log('Schema de Article encontrado:\n');
      console.log(JSON.stringify(article,  null, 2));
    } else {
      console.log('Tipos de contenido disponibles:');
      r.data.data.forEach(ct => console.log('  -', ct.uid));
    }
  } else {
    console.log('Error o endpoint no disponible:', r.status);
    
    // Intentar método alternativo: create un artículo con campos expandidos para ver que falla
    console.log('\nProbando con un POST detallado...');
    const rando = Math.random().toString(36).substring(7);
    const postTest = await fetchAPI('https://strapi-alba.onrender.com/api/articles', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: {
        data: {
          titulo: `Prueba ${rando}`,
          slug: `prueba-${rando}`,
          content: `<p>Test</p>`,
          excerp: `Test`,
          fecha: new Date().toISOString().split('T')[0]
        }
      }
    });
    
    console.log('\nPrueba 1 - Datos simples: Status', postTest.status);
    if (postTest.status !== 201) {
      console.log('Error:', postTest.data?.error?.message);
      if (postTest.data?.error?.details?.errors) {
        postTest.data.error.details.errors.forEach(e => {
          console.log('  Campo:', e.path.join('.'), '-> ', e.message);
        });
      }
    } else {
      console.log('✓ Creado exitosamente');
    }
  }
})();
