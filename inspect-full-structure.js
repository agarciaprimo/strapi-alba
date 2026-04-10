#!/usr/bin/env node

/**
 * Script para inspeccionar TODA la estructura del Strapi remoto
 * Incluyendo artículos con relaciones e imágenes/media
 */

const https = require('https');
const http = require('http');

const LOCAL_STRAPI = 'http://localhost:1337';
const REMOTE_STRAPI = 'https://strapi-alba.onrender.com';
const REMOTE_TOKEN = 'bbe7d8e65e614b6c9f39429189242798a8d8bfb2b49f3418d1dee2d5dcf596bb57f9fc67ca373387f2e156e61f7a68920763f1a357fbb0affdef05279f82d5f837e0e2fee0c8871bcd110ef675c9a96f8e254524f1e3ff3cfb736873f3ea340b0568dbafe36a861740deb30fe38e74509dcf517eccb8157de185c912142534a9';

function fetchAPI(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function inspect() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  INSPECCIÓN COMPLETA ESTRUCTURA STRAPI                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Inspeccionar artículos locales con populate complete
    console.log('📄 Inspeccionando ARTÍCULOS LOCALES con populate=*...\n');
    const localArticlesResponse = await fetchAPI(
      `${LOCAL_STRAPI}/api/articles?pagination[limit]=1&populate=*`
    );

    if (localArticlesResponse.status === 200 && localArticlesResponse.data.data.length > 0) {
      const article = localArticlesResponse.data.data[0];
      console.log('═══════════════════════════════════════════════════════════');
      console.log('ARTÍCULO LOCAL - ESTRUCTURA COMPLETA:');
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log(JSON.stringify(article, null, 2));
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('CAMPOS ENCONTRADOS EN ARTÍCULO LOCAL:');
      console.log('═══════════════════════════════════════════════════════════\n');
      Object.keys(article).forEach(key => {
        const val = article[key];
        console.log(`  • ${key}: ${typeof val} ${Array.isArray(val) ? `[${val.length ? 'items' : 'empty'}]` : ''}`);
      });
    }

    // 2. Inspeccionar media/files locales
    console.log('\n\n📸 Inspeccionando MEDIA/UPLOAD LOCAL...\n');
    const mediaResponse = await fetchAPI(
      `${LOCAL_STRAPI}/api/upload/files?pagination[limit]=10`
    );

    if (mediaResponse.status === 200) {
      const files = mediaResponse.data || [];
      console.log(`✓ Se encontraron ${files.length} archivos de media\n`);
      if (files.length > 0) {
        console.log('Primer archivo:');
        console.log(JSON.stringify(files[0], null, 2));
      }
    }

    // 3. Comparar con remoto
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('INSPECCIÓN REMOTO - Estructura de artículo con populate');
    console.log('═══════════════════════════════════════════════════════════\n');

    const remoteArticleResponse = await fetchAPI(
      `${REMOTE_STRAPI}/api/articles?pagination[limit]=1&populate=*`,
      {
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
      }
    );

    if (remoteArticleResponse.status === 200 && remoteArticleResponse.data.data.length > 0) {
      const article = remoteArticleResponse.data.data[0];
      console.log('ARTÍCULO REMOTO - Estructura:');
      console.log(JSON.stringify(article, null, 2));
    } else {
      console.log('No hay artículos en remoto. Mostrando estructura que aceptaría el POST:\n');
      console.log('Intenta con estos campos en el POST:');
      console.log(JSON.stringify({
        data: {
          titulo: 'string',
          slug: 'string', 
          content: 'string',
          excerp: 'string',
          fecha: 'ISO date or null',
          "categories": { "connect": [1, 2] }  // Probablemente debería ser "categories" y connect con IDs
        }
      }, null, 2));
    }

    // 4. Verificar qué campos acepta la API POST vía error validation
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('PRUEBA: POST con "categories" en lugar de "category"');
    console.log('═══════════════════════════════════════════════════════════\n');

    const testResponse = await fetchAPI(
      `${REMOTE_STRAPI}/api/articles`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` },
        body: {
          data: {
            titulo: 'Test Article With Categories',
            slug: 'test-article-with-categories',
            content: 'Test content',
            excerp: 'Test excerpt',
            categories: { connect: [2] }  // Intentar con "categories" plural
          }
        }
      }
    );

    console.log(`Status: ${testResponse.status}`);
    if (testResponse.status === 201) {
      console.log('✓ ¡Funciona con "categories"!');
      console.log(JSON.stringify(testResponse.data, null, 2));
    } else {
      console.log('✗ No funciona así. Respuesta:');
      console.log(JSON.stringify(testResponse.data, null, 2));
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

inspect().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
