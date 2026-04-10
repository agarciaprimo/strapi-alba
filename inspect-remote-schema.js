#!/usr/bin/env node

/**
 * Script para inspeccionar el schema de artículos en el Strapi remoto
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function inspectSchema() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  INSPECCIÓN DE SCHEMA - STRAPI REMOTO                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Intentar obtener un artículo existente
    console.log('📄 Obteniendo artículos existentes...\n');
    const articlesResponse = await fetchAPI(
      `${REMOTE_STRAPI}/api/articles?pagination[limit]=1&populate=*`,
      {
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
      }
    );

    if (articlesResponse.status !== 200) {
      console.error('✗ Error al obtener artículos:', articlesResponse.status);
      return;
    }

    const articles = articlesResponse.data.data;
    
    if (articles.length === 0) {
      console.log('⚠ No hay artículos existentes. Probando estructura con solicitud POST vacía...\n');
      
      // Intentar un POST para ver errores de validación
      const testResponse = await fetchAPI(
        `${REMOTE_STRAPI}/api/articles`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` },
          body: { data: {} }
        }
      );

      console.log('Respuesta de prueba (POST vacío):');
      console.log(`Status: ${testResponse.status}`);
      console.log(JSON.stringify(testResponse.data, null, 2));
      
      if (testResponse.data?.error?.details?.errors) {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('CAMPOS REQUERIDOS (según errores de validación):');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        testResponse.data.error.details.errors.forEach(err => {
          console.log(`  • ${err.path.join('.')}: ${err.message}`);
        });
      }
      return;
    }

    const article = articles[0];
    console.log('✓ Artículo encontrado:\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('CAMPOS DISPONIBLES EN ARTICLES:');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Mostrar estructura
    console.log('Estructura JSON completa:');
    console.log(JSON.stringify(article, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('RESUMEN DE CAMPOS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const fields = Object.keys(article);
    console.log(`Total de campos: ${fields.length}\n`);

    fields.forEach(field => {
      const value = article[field];
      let type = typeof value;
      if (Array.isArray(value)) type = 'array';
      if (value === null) type = 'null';
      
      console.log(`  • ${field}: ${type}`);
      
      // Mostrar detalles de campos complejos
      if (type === 'object' && !Array.isArray(value) && value !== null) {
        console.log(`    └─ Subfields: ${Object.keys(value).join(', ')}`);
      }
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('CAMPOS QUE PROBABLEMENTE QUIERES USAR:');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Identificar campos potenciales
    const textFields = fields.filter(f => {
      const val = article[f];
      return typeof val === 'string' && val.length > 100;
    });

    const titleFields = fields.filter(f => {
      const val = article[f];
      return typeof val === 'string' && f.toLowerCase().includes('title');
    });

    const slugFields = fields.filter(f => f === 'slug');
    const categoryFields = fields.filter(f => f.toLowerCase().includes('categor'));

    if (titleFields.length > 0) {
      console.log('📝 Campo de TÍTULO:', titleFields.join(', '));
    }
    if (slugFields.length > 0) {
      console.log('🔗 Campo de SLUG:', slugFields.join(', '));
    }
    if (textFields.length > 0) {
      console.log('📄 Campos de CONTENIDO/TEXTO:', textFields.join(', '));
    }
    if (categoryFields.length > 0) {
      console.log('📁 Campos de CATEGORÍA:', categoryFields.join(', '));
    }

    // 2. También obtener esquema de categorías
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('SCHEMA DE CATEGORÍAS:');
    console.log('═══════════════════════════════════════════════════════════\n');

    const categoriesResponse = await fetchAPI(
      `${REMOTE_STRAPI}/api/categories?pagination[limit]=1&populate=*`,
      {
        headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
      }
    );

    if (categoriesResponse.status === 200 && categoriesResponse.data.data.length > 0) {
      const category = categoriesResponse.data.data[0];
      console.log('✓ Categoría encontrada\n');
      console.log('Campos de categoría:', Object.keys(category).join(', '));
    }

  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

inspectSchema().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
