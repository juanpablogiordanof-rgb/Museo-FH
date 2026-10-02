import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Permite abrir dist/index.html con doble clic (file://).
 *
 * Los navegadores bloquean en file:// los <script type="module">, fetch() y
 * las imágenes como texturas WebGL. Por eso, en el build:
 *  - el JS se empaqueta como script clásico (IIFE) sin atributo crossorigin;
 *  - se genera dist/contenido.js: una copia de contenido.json con las imágenes
 *    incrustadas (data URI). Solo se usa si la página se abre como file://;
 *    servida por http (GitHub Pages, vite preview) se lee contenido.json.
 */
function abrirSinServidor() {
  let publicDir;
  return {
    name: 'museo-abrir-sin-servidor',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<script type="module"/g, '<script defer')
          .replace(/ crossorigin/g, '');
      },
    },
    generateBundle() {
      const contenido = JSON.parse(
        fs.readFileSync(path.join(publicDir, 'contenido.json'), 'utf8'),
      );
      for (const sala of contenido.salas ?? []) {
        for (const obra of sala.obras ?? []) {
          if (!obra.imagen || /^(data:|https?:)/.test(obra.imagen)) continue;
          const archivo = path.join(publicDir, obra.imagen);
          const mime = MIME[path.extname(archivo).toLowerCase()];
          if (!mime || !fs.existsSync(archivo)) {
            this.warn(`Imagen no encontrada o formato no soportado: ${obra.imagen}`);
            continue;
          }
          const datos = fs.readFileSync(archivo);
          if (datos.length > 1.5 * 1024 * 1024) {
            this.warn(`${obra.imagen} pesa ${(datos.length / 1048576).toFixed(1)} MB; conviene reducirla (máx. 1600 px).`);
          }
          obra.imagen = `data:${mime};base64,${datos.toString('base64')}`;
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'contenido.js',
        source: `window.__CONTENIDO__ = ${JSON.stringify(contenido)};\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
  },
  plugins: [abrirSinServidor()],
});
