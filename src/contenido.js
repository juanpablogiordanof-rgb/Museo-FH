// Carga public/contenido.json. Al abrir el museo con doble clic (file://)
// el navegador bloquea fetch(), así que se usa contenido-local.js, una copia
// generada automáticamente durante el build (ver vite.config.js).

function cargarScript(src) {
  return new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolver;
    s.onerror = rechazar;
    document.head.append(s);
  });
}

export async function cargarContenido() {
  let datos;
  if (location.protocol === 'file:') {
    await cargarScript('./contenido-local.js');
    datos = window.__MUSEO_CONTENIDO_LOCAL__;
  } else {
    const r = await fetch('./contenido.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`contenido.json: HTTP ${r.status}`);
    datos = await r.json();
  }
  if (!datos || !Array.isArray(datos.salas)) throw new Error('contenido.json no tiene la lista "salas".');
  datos.museo ??= {};
  datos.ui ??= {};
  for (const sala of datos.salas) {
    sala.obras ??= [];
    sala.cedulas ??= [];
    sala.preguntas ??= [];
    sala.color ??= '#888888';
  }
  return datos;
}
