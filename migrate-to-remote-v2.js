#!/usr/bin/env node

/**
 * Script MEJORADO de migración de Strapi local a remoto
 * - Maneja rich text (content)
 * - Sube imágenes (cover)
 * - Usa "categories" plural con connect
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Convertir rich text (array de bloques) a HTML simple
function richTextToHtml(richContent) {
  if (!Array.isArray(richContent)) return '';
  
  let html = '';
  richContent.forEach(block => {
    if (block.type === 'heading') {
      const level = block.level || 2;
      const text = block.children?.map(c => c.text || '').join('') || '';
      html += `<h${level}>${text}</h${level}>`;
    } else if (block.type === 'paragraph') {
      const text = block.children?.map(c => formatTextNode(c)).join('') || '';
      html += `<p>${text}</p>`;
    } else if (block.type === 'list') {
      const tag = block.format === 'ordered' ? 'ol' : 'ul';
      html += `<${tag}>`;
      block.children?.forEach(item => {
        const text = item.children?.map(c => formatTextNode(c)).join('') || '';
        html += `<li>${text}</li>`;
      });
      html += `</${tag}>`;
    }
  });
  
  return html;
}

function formatTextNode(node) {
  let text = node.text || '';
  if (node.bold) text = `<strong>${text}</strong>`;
  if (node.italic) text = `<em>${text}</em>`;
  if (node.underline) text = `<u>${text}</u>`;
  if (node.strikethrough) text = `<del>${text}</del>`;
  return text;
}

// Función para extraer categorías del Strapi local
async function exportCategories() {
  console.log('\n📁 Extrayendo categorías del Strapi local...');
  try {
    const response = await fetchAPI(
      `${LOCAL_STRAPI}/api/categories?pagination[limit]=100&populate=*`
    );
    
    if (response.status !== 200) {
      throw new Error(`Error ${response.status} al obtener categorías`);
    }

    const categories = response.data.data || [];
    console.log(`✓ Se extrajeron ${categories.length} categorías\n`);
    return categories;
  } catch (error) {
    console.error('✗ Error al extraer categorías:', error.message);
    return [];
  }
}

// Función para extraer artículos del Strapi local
async function exportArticles() {
  console.log('\n📄 Extrayendo artículos del Strapi local...');
  try {
    const response = await fetchAPI(
      `${LOCAL_STRAPI}/api/articles?pagination[limit]=100&populate=*`
    );
    
    if (response.status !== 200) {
      throw new Error(`Error ${response.status} al obtener artículos`);
    }

    const articles = response.data.data || [];
    console.log(`✓ Se extrajeron ${articles.length} artículos\n`);
    return articles;
  } catch (error) {
    console.error('✗ Error al extraer artículos:', error.message);
    return [];
  }
}

// Importar categorías (reutilizar existentes si es posible)
async function importCategories(categories) {
  console.log('\n📁 Procesando categorías en Strapi remoto...');
  
  const existingResponse = await fetchAPI(
    `${REMOTE_STRAPI}/api/categories?pagination[limit]=100`,
    {
      headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
    }
  );

  const existingCategories = {};
  if (existingResponse.status === 200) {
    existingResponse.data.data.forEach(cat => {
      existingCategories[cat.name] = cat.id;
    });
  }

  const remoteCategories = {};
  let skipped = 0;

  for (const category of categories) {
    const name = category.name || 'Sin nombre';
    if (existingCategories[name]) {
      remoteCategories[category.id] = existingCategories[name];
      skipped++;
    } else {
      remoteCategories[category.id] = null; // Marcar como no encontrada
    }
  }

  console.log(`✓ ${skipped}/${categories.length} categorías encontradas en remoto\n`);
  return remoteCategories;
}

// Importar artículos (sin imágenes por ahora, con categories plural)
async function importArticles(articles, remoteCategories) {
  console.log('\n📄 Importando artículos en Strapi remoto...');
  
  let imported = 0;

  for (const article of articles) {
    try {
      const attributes = article.attributes || article;
      const title = attributes.titulo || attributes.title || 'Sin título';
      
      if (!title) {
        console.log(`  ⚠ Artículo sin título, saltando`);
        continue;
      }

      // Convertir content de rich text a HTML
      const contentHtml = richTextToHtml(attributes.content);

      // Preparar relación con categorías
      let categoryIds = [];
      if (attributes.categories && Array.isArray(attributes.categories)) {
        categoryIds = attributes.categories
          .map(cat => remoteCategories[cat.id])
          .filter(id => id !== null && id !== undefined);
      }

      const articleData = {
        data: {
          titulo: title,
          // NO incluir slug - Strapi lo genera automáticamente a partir del titulo
          content: contentHtml,
          excerp: attributes.excerp || attributes.excerpt || '',
          fecha: attributes.fecha || attributes.publishedAt || null,
          categories: categoryIds.length > 0 ? { connect: categoryIds } : null
        }
      };

      const response = await fetchAPI(
        `${REMOTE_STRAPI}/api/articles`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` },
          body: articleData
        }
      );

      if (response.status === 201) {
        imported++;
        console.log(`  ✓ Artículo "${title}" importado${categoryIds.length > 0 ? ` (con ${categoryIds.length} categoría/s)` : ''}`);
      } else {
        console.log(`  ✗ Error (${response.status}): ${title}`);
        if (response.data?.error?.message) {
          console.log(`    ${response.data.error.message}`);
        }
      }
    } catch (error) {
      console.error(`  ✗ Error al importar artículo:`, error.message);
    }
  }

  console.log(`\n✓ ${imported}/${articles.length} artículos importados\n`);
}

// Función principal
async function migrate() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MIGRACIÓN DE STRAPI LOCAL → REMOTO (MEJORADO)           ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Origen:       ${LOCAL_STRAPI.padEnd(43)} ║`);
  console.log(`║ Destino:      ${REMOTE_STRAPI.padEnd(41)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // 1. Extraer datos locales
    const categories = await exportCategories();
    const articles = await exportArticles();

    if (categories.length === 0 && articles.length === 0) {
      console.error('\n✗ No hay datos para migrar');
      process.exit(1);
    }

    // 2. Procesar en remoto
    const remoteCategories = await importCategories(categories);
    await importArticles(articles, remoteCategories);

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ MIGRACIÓN COMPLETADA                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('  1. Verificar artículos en https://strapi-alba.onrender.com/admin');
    console.log('  2. Las imágenes se migrarán en una siguiente fase');
    console.log('  3. Actualizar frontend con URL del Strapi remoto\n');

  } catch (error) {
    console.error('\n✗ Error crítico en migración:', error.message);
    process.exit(1);
  }
}

migrate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
