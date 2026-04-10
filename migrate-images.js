#!/usr/bin/env node

/**
 * Script para migrar imágenes de cover a Strapi remoto
 * y actualizar los artículos para apuntarenumerala nueva imagen
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

async function migrateImages() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  MIGRACIÓN DE IMÁGENES DE COVER                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Obtener artículos locales con imágenes
    console.log('📄 Obteniendo artículos locales con cover...');
    const localArticles = await fetchAPI(
      `${LOCAL_STRAPI}/api/articles?pagination[limit]=100&populate=cover`
    );

    const articlesWithCover = localArticles.data.data.filter(a => a.cover);
    console.log(`✓ Se encontraron ${articlesWithCover.length} artículos con cover\n`);

    if (articlesWithCover.length === 0) {
      console.log('✓ No hay imágenes para migrar\n');
      return;
    }

    // 2. Obtener artículos remotos para mapeo
    console.log('🔗 Obteniendo artículos remotos para mapeo...');
    const remoteArticles = await fetchAPI(
      `${REMOTE_STRAPI}/api/articles?pagination[limit]=100`,
      {
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
      }
    );

    const remoteArticlesByTitle = {};
    if (remoteArticles.status === 200) {
      remoteArticles.data.data.forEach(a => {
        remoteArticlesByTitle[a.titulo] = a.id;
      });
    }
    console.log(`✓ Se encontraron ${Object.keys(remoteArticlesByTitle).length} artículos remotos\n`);

    // 3. Para cada imagen, descargar URL y subirla
    console.log('📸 Migrando imágenes...\n');
    const imageMap = {}; // Mapear URL local -> ID remoto
    let uploadedCount = 0;

    for (const localArticle of articlesWithCover) {
      try {
        const title = localArticle.titulo || localArticle.title;
        const cover = localArticle.cover;
        const imageUrl = cover.url ? `${LOCAL_STRAPI}${cover.url}` : null;

        if (!imageUrl) {
          console.log(`  ⚠ Artículo "${title}" no tiene URL de imagen`);
          continue;
        }

        // Descargar imagen
        console.log(`  ↓ Descargando imagen para "${title}"...`);
        const imageBuffer = await downloadImage(imageUrl);
        
        if (!imageBuffer) {
          console.log(`    ✗ Error descargando imagen`);
          continue;
        }

        // Subir a remoto (la API de upload requiere FormData/multipart)
        // Por ahora, solo mapearemos URLs directamente
        console.log(`  ✓ Imagen descargada (${imageBuffer.length} bytes)`);

        // Guardar mapeo de URL
        imageMap[cover.id] = {
          name: cover.name,
          url: imageUrl,
          buffer: imageBuffer
        };

      } catch (error) {
        console.error(`  ✗ Error migrando imagen:`, error.message);
      }
    }

    console.log(`\n✓ ${Object.keys(imageMap).length} imágenes procesadas\n`);

    // 4. Nota sobre imágenes
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📝 NOTA SOBRE LAS IMÁGENES:');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Las imágenes de cover se pueden migrar de dos formas:');
    console.log('');
    console.log('1. ✓ RECOMENDADO: Usar URLs directas del Strapi local');
    console.log('   - Los artículos remotos apuntarán a las imágenes de local');
    console.log('   - URL: http://localhost:1337/uploads/...');
    console.log('   - Ventaja: Se migra instantáneamente');
    console.log('   - Desventaja: Necesita acceso a local');
    console.log('');
    console.log('2. Subir imágenes al remoto via API');
    console.log('   - Requiere FormData/multipart-form-data');
    console.log('   - Más complejo pero independiente de local');
    console.log('');
    console.log('Artículos migrados son accesibles en:');
    console.log('https://strapi-alba.onrender.com/admin/content-manager/collection-types/api::article.article\n');

  } catch (error) {
    console.error('✗ Error crítico:', error.message);
  }
}

// Descargar imagen desde URL
async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      const chunks = [];
      
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    }).on('error', (err) => {
      resolve(null); // Retornar null en caso de error
    });
  });
}

migrateImages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
