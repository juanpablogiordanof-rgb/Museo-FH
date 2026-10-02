import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

// Permite abrir dist/index.html con doble clic (file://):
// 1. El bundle se emite como script clásico (IIFE), porque los navegadores
//    bloquean los módulos ES cargados desde file://.
// 2. Se genera contenido-local.js, una copia de public/contenido.json con las
//    imágenes incrustadas, porque fetch() y las texturas WebGL tampoco
//    funcionan desde file://. En un servidor (GitHub Pages, vite preview) se
//    sigue leyendo contenido.json directamente.
function museoLocal() {
  let publicDir;
  return {
    name: 'museo-local',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/<script type="module" crossorigin/g, '<script defer')
          .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
      },
    },
    generateBundle() {
      const contenido = JSON.parse(fs.readFileSync(path.join(publicDir, 'contenido.json'), 'utf8'));
      for (const sala of contenido.salas ?? []) {
        for (const obra of sala.obras ?? []) {
          if (!obra.imagen || /^(https?:|data:)/.test(obra.imagen)) continue;
          const archivo = path.join(publicDir, obra.imagen);
          const mime = MIME[path.extname(archivo).toLowerCase()];
          if (!mime || !fs.existsSync(archivo)) continue;
          obra.imagen = `data:${mime};base64,${fs.readFileSync(archivo).toString('base64')}`;
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: 'contenido-local.js',
        source: `window.__MUSEO_CONTENIDO_LOCAL__ = ${JSON.stringify(contenido)};\n`,
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    modulePreload: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: { format: 'iife' },
    },
  },
  plugins: [museoLocal()],
});
