/**
 * Carga el contenido del museo.
 * - Servido por http(s): lee contenido.json (se puede editar sin recompilar).
 * - Abierto con doble clic (file://): los navegadores bloquean fetch, así que
 *   se usa contenido.js, que el build genera a partir de contenido.json.
 */
export async function cargarContenido() {
  if (location.protocol !== 'file:') {
    try {
      const r = await fetch('contenido.json', { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch {
      // se intenta con contenido.js
    }
  }
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'contenido.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  if (!window.__CONTENIDO__) throw new Error('contenido vacío');
  return window.__CONTENIDO__;
}
