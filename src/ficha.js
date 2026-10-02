// Panel HTML que muestra la cédula de una obra o el texto de un panel.
export function crearFicha(raiz, ui) {
  const caja = raiz.querySelector('.ficha-caja');
  const salaEl = raiz.querySelector('.ficha-sala');
  const tituloEl = raiz.querySelector('.ficha-titulo');
  const imagenEl = raiz.querySelector('.ficha-imagen');
  const textoEl = raiz.querySelector('.ficha-texto');
  const cerrarEl = raiz.querySelector('.ficha-cerrar');
  cerrarEl.textContent = ui.cerrar ?? '×';

  function parrafos(texto) {
    return String(texto ?? '').split('\n').filter(Boolean).map((t) => {
      const p = document.createElement('p');
      p.textContent = t;
      return p;
    });
  }

  function lista(items) {
    const ol = document.createElement('ol');
    for (const t of items) {
      const li = document.createElement('li');
      li.textContent = t;
      ol.append(li);
    }
    return ol;
  }

  return {
    abierta: () => !raiz.classList.contains('oculto'),
    abrir(ficha) {
      const { sala } = ficha;
      caja.style.setProperty('--acento', sala?.color ?? '#a0612b');
      salaEl.textContent = sala ? `${sala.etiqueta ?? sala.id} · ${sala.titulo}` : '';
      tituloEl.textContent = ficha.titulo ?? '';
      imagenEl.replaceChildren();
      if (ficha.tipo === 'obra') {
        if (ficha.imagen) {
          const img = document.createElement('img');
          img.src = ficha.imagen;
          img.alt = ficha.titulo ?? '';
          imagenEl.append(img);
        } else {
          const p = document.createElement('div');
          p.className = 'pendiente';
          p.textContent = ui.imagenPendiente ?? '';
          imagenEl.append(p);
        }
      }
      textoEl.replaceChildren(...(ficha.preguntas ? [lista(ficha.preguntas)] : ficha.lista ? [lista(ficha.lista)] : parrafos(ficha.texto)));
      raiz.classList.remove('oculto');
      caja.scrollTop = 0;
      cerrarEl.focus({ preventScroll: true });
    },
    cerrar() {
      raiz.classList.add('oculto');
    },
    alCerrar(fn) {
      cerrarEl.addEventListener('click', fn);
      raiz.addEventListener('click', (e) => {
        if (e.target === raiz) fn();
      });
    },
  };
}
