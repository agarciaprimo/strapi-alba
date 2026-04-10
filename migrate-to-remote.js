#!/usr/bin/env node

/**
 * Script de migración de Strapi local a remoto via API REST
 * Extrae artículos, categorías e imágenes del Strapi local
 * e importa en el Strapi remoto usando el token de Full Access
 */

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

const LOCAL_STRAPI = process.env.LOCAL_STRAPI || 'http://localhost:1337';
const REMOTE_STRAPI = process.env.REMOTE_STRAPI || 'https://strapi-alba.onrender.com';
const REMOTE_TOKEN = process.env.REMOTE_TOKEN || 'bbe7d8e65e614b6c9f39429189242798a8d8bfb2b49f3418d1dee2d5dcf596bb57f9fc67ca373387f2e156e61f7a68920763f1a357fbb0affdef05279f82d5f837e0e2fee0c8871bcd110ef675c9a96f8e254524f1e3ff3cfb736873f3ea340b0568dbafe36a861740deb30fe38e74509dcf517eccb8157de185c912142534a9';

// Función para hacer fetch genérica
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
    console.log(`✓ Se extrajeron ${articles.length} artículos`);
    
    // Debug: mostrar estructura del primer item
    if (articles.length > 0) {
      console.log(`  [DEBUG] Estructura del primer item:`, JSON.stringify(articles[0], null, 2).substring(0, 200));
    }
    
    return articles;
  } catch (error) {
    console.error('✗ Error al extraer artículos:', error.message);
    return [];
  }
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
    console.log(`✓ Se extrajeron ${categories.length} categorías`);
    
    // Debug: mostrar estructura del primer item
    if (categories.length > 0) {
      console.log(`  [DEBUG] Estructura del primer item:`, JSON.stringify(categories[0], null, 2).substring(0, 200));
    }
    
    return categories;
  } catch (error) {
    console.error('✗ Error al extraer categorías:', error.message);
    return [];
  }
}

// Función para importar categorías en Strapi remoto
async function importCategories(categories) {
  console.log('\n📁 Importando categorías en Strapi remoto...');
  
  // Primero, obtener las categorías existentes
  console.log('  Verificando categorías existentes...');
  const existingResponse = await fetchAPI(
    `${REMOTE_STRAPI}/api/categories?pagination[limit]=100`,
    {
      headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` }
    }
  );

  const existingCategories = {};
  if (existingResponse.status === 200 && existingResponse.data.data) {
    existingResponse.data.data.forEach(cat => {
      existingCategories[cat.name] = cat.id;
    });
  }

  console.log(`  ✓ ${Object.keys(existingCategories).length} categorías existentes encontradas\n`);

  const remoteCategories = {};
  let imported = 0;
  let skipped = 0;

  for (const category of categories) {
    try {
      const attributes = category.attributes || category;
      const name = attributes.name || 'Sin nombre';
      
      if (!attributes.name) {
        console.log(`  ⚠ Categoría sin atributos válidos, saltando`);
        continue;
      }

      // Si la categoría ya existe, usar su ID
      if (existingCategories[name]) {
        console.log(`  ⏭ Categoría "${name}" ya existe (ID: ${existingCategories[name]})`);
        remoteCategories[category.id] = existingCategories[name];
        skipped++;
        continue;
      }

      // Crear solo si no existe
      const categoryData = {
        data: {
          name: attributes.name,
          slug: attributes.slug || attributes.name.toLowerCase().replace(/\s+/g, '-')
        }
      };

      const response = await fetchAPI(
        `${REMOTE_STRAPI}/api/categories`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${REMOTE_TOKEN}` },
          body: categoryData
        }
      );

      if (response.status === 201 && response.data.data) {
        remoteCategories[category.id] = response.data.data.id;
        imported++;
        console.log(`  ✓ Categoría "${attributes.name}" creada (ID: ${response.data.data.id})`);
      } else {
        console.log(`  ✗ Error creando categoría (${response.status}): ${attributes.name}`);
      }
    } catch (error) {
      console.error(`  ✗ Error al importar categoría:`, error.message);
    }
  }

  console.log(`\n✓ ${imported} nuevas + ${skipped} existentes = ${imported + skipped}/${categories.length} categorías disponibles`);
  return remoteCategories;
}

// Función para importar artículos en Strapi remoto
async function importArticles(articles, remoteCategories) {
  console.log('\n📄 Importando artículos en Strapi remoto...');
  
  let imported = 0;

  for (const article of articles) {
    try {
      const attributes = article.attributes || article;
      
      // El campo de título en el Strapi local se llama "titulo" (con tilde)
      const title = attributes.titulo || attributes.title || attributes.name || 'Sin título';
      
      if (!attributes.titulo && !attributes.title) {
        console.log(`  ⚠ Artículo sin título, saltando`);
        continue;
      }

      // Preparar relación con categoría
      let categoryId = null;
      const catData = attributes.category?.data;
      
      if (catData) {
        // Si es un objeto con id
        if (catData.id && remoteCategories[catData.id]) {
          categoryId = remoteCategories[catData.id];
        }
        // Si es un array
        else if (Array.isArray(catData) && catData.length > 0 && remoteCategories[catData[0].id]) {
          categoryId = remoteCategories[catData[0].id];
        }
      }

      // Mapear campos: el slug puede venir de "slug" o generarse del título
      const articleData = {
        data: {
          titulo: title, // Campo de título
          slug: attributes.slug || title.toLowerCase().replace(/\s+/g, '-'),
          content: attributes.content || attributes.body || '', // Usar "content" NO "contenido"
          excerp: attributes.extracto || attributes.excerpt || '', // Usar "excerp" NO "excerpt"
          fecha: attributes.fecha || attributes.publishedAt || null, // Fecha de publicación
          category: categoryId ? { connect: [categoryId] } : null
          // NO incluir createdAt, updatedAt, publishedAt - Strapi los genera automáticamente
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
        console.log(`  ✓ Artículo "${title}" importado`);
      } else {
        console.log(`  ✗ Error (${response.status}): ${title}`);
        if (response.data?.error?.message) {
          console.log(`    Detalles: ${response.data.error.message}`);
        }
        if (response.data?.error?.details?.errors) {
          console.log(`    Detalles de validación:`, JSON.stringify(response.data.error.details.errors));
        }
      }
    } catch (error) {
      console.error(`  ✗ Error al importar artículo:`, error.message);
    }
  }

  console.log(`\n✓ ${imported}/${articles.length} artículos importados`);
}

// Función principal
async function migrate() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MIGRACIÓN DE STRAPI LOCAL → REMOTO VIA API REST         ║');
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

    // 2. Importar en remoto
    const remoteCategories = await importCategories(categories);
    await importArticles(articles, remoteCategories);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ MIGRACIÓN COMPLETADA                                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n✗ Error crítico en migración:', error.message);
    process.exit(1);
  }
}

// Ejecutar
migrate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
