# Migración de Strapi Local a Remoto

## 📋 Estado Actual

✅ Strapi local está cargado con todos los artículos y categorías
✅ Strapi remoto está disponible en `https://strapi-alba.onrender.com`
✅ Token de Full Access obtenido ✓

## 🚀 Cómo ejecutar la migración

### Opción 1: En Terminal (Recomendado)

```bash
cd '/Users/andergarciaprimo/Desktop/EA web 01/web03/strapi-cms'

# Primero, inicia Strapi en otra ventana/tab de terminal:
npm run develop

# En otra ventana/tab, espera 30-40 segundos y luego ejecuta:
node migrate-to-remote.js
```

### Opción 2: Con variables de entorno

```bash
cd '/Users/andergarciaprimo/Desktop/EA web 01/web03/strapi-cms'
npm run develop > /tmp/strapi.log 2>&1 &
sleep 40
node migrate-to-remote.js
```

## ℹ️ Qué hace el script

El script `migrate-to-remote.js`:

1. **Conecta al Strapi local** (`http://localhost:1337`)
2. **Extrae todas las categorías** via API `/api/categories`
3. **Importa categorías en Strapi remoto** via API con el token
4. **Extrae todos los artículos** via API `/api/articles`
5. **Importa artículos con sus relaciones** en el Strapi remoto

## 📊 Resultados esperados

Deberías ver algo como:

```
╔════════════════════════════════════════════════════════════╗
║  MIGRACIÓN DE STRAPI LOCAL → REMOTO VIA API REST         ║
╠════════════════════════════════════════════════════════════╣
║ Origen:       http://localhost:1337                       ║
║ Destino:      https://strapi-alba.onrender.com           ║
╚════════════════════════════════════════════════════════════╝

📁 Extrayendo categorías del Strapi local...
✓ Se extrajeron 12 categorías

📄 Extrayendo artículos del Strapi local...
✓ Se extrajeron 18 artículos

📁 Importando categorías en Strapi remoto...
  ✓ Categoría "Desarrollo" importada (ID: 1)
  ✓ Categoría "Diseño" importada (ID: 2)
  ...

📄 Importando artículos en Strapi remoto...
  ✓ Artículo "Cómo crear un website" importado
  ✓ Artículo "SEO para principiantes" importado
  ...

╔════════════════════════════════════════════════════════════╗
║  ✓ MIGRACIÓN COMPLETADA                                  ║
╚════════════════════════════════════════════════════════════╝
```

## 🔍 Verificar que funcionó

Una vez completada la migración:

1. Ve a `https://strapi-alba.onrender.com/admin`
2. Navega a **Content Manager**
3. Deberías ver todos los artículos y categorías importados

## Actualizar el frontend

Después de la migración exitosa, actualiza [blog.html](../blog.html) para usar el Strapi remoto:

Con la URL query param (recomendado):
```
blog.html?strapi=https://strapi-alba.onrender.com
```

O hardcodea la URL en [main.js](../main.js) en la función `resolveStrapiUrl()`.

## 📝 Notas

- La migración preserva la estructura de datos
- Las relaciones entre artículos y categorías se mantienen
- Los artículos conservan sus timestamps originales
- Las imágenes se migrarán en una fase posterior (si aplica)

---

¿Necesitas ayuda? Ejecuta el comando y comparte el output.
