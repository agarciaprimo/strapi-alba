#!/usr/bin/env node

/**
 * Script para limpiar artículos duplicados en Strapi remoto
 * y luego hacer una migración completa
 */

const https = require('https');
const http = require('http');

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

async function cleanupArticles() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  LIMPIEZA DE ARTÍCULOS DUPLICADOS                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Obtener todos los artículos remotos
    console.log('📄 Obteniendo artículos del Strapi remoto...');
    const response = await fetchAPI(
      `${REMOTE_STRAPI}/api/articles?pagination[limit]=100`,
      {
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
      }
    );

    if (response.status !== 200) {
      console.error('✗ Error al obtener artículos:', response.status);
      return;
    }

    const articles = response.data.data || [];
    console.log(`✓ Se encontraron ${articles.length} artículos\n`);

    if (articles.length === 0) {
      console.log('✓ No hay artículos para limpiar. Base de datos remota está vacía.\n');
      return;
    }

    // 2. Borrar todos los artículos
    console.log('🗑️  Eliminando artículos existentes...\n');
    let deleted = 0;

    for (const article of articles) {
      try {
        const deleteResponse = await fetchAPI(
          `${REMOTE_STRAPI}/api/articles/${article.id}`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
          }
        );

        if (deleteResponse.status === 200 || deleteResponse.status === 204) {
          deleted++;
          console.log(`  ✓ Elimina artículo: "${article.titulo || 'Sin título'}" (ID: ${article.id})`);
        } else {
          console.log(`  ✗ Error eliminando artículo ${article.id}`);
        }
      } catch (error) {
        console.error(`  ✗ Error:`, error.message);
      }
    }

    console.log(`\n✓ ${deleted}/${articles.length} artículos eliminados\n`);

  } catch (error) {
    console.error('✗ Error crítico:', error.message);
  }
}

cleanupArticles().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
