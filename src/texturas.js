import * as THREE from 'three';

export const FUENTE_TITULO = "Georgia, 'Times New Roman', serif";
export const FUENTE_TEXTO = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Tamaño máximo (px) de cualquier textura, por rendimiento en gráficos integrados. */
export const MAX_TEXTURA = 1600;

let anisotropia = 1;
export function configurarAnisotropia(renderer) {
  anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());
}

function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = Math.min(ancho, MAX_TEXTURA);
  c.height = Math.min(alto, MAX_TEXTURA);
  return c;
}

export function texturaDesdeCanvas(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

/** Parte un texto en líneas que caben en `anchoMax` (respeta saltos de línea). */
export function envolver(ctx, texto, anchoMax) {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split('\n')) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    let linea = '';
    for (const palabra of palabras) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (ctx.measureText(prueba).width > anchoMax && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    }
    lineas.push(linea);
  }
  return lineas;
}

/**
 * Busca el mayor tamaño de fuente (entre tamMax y tamMin) con el que el texto
 * entra en el recuadro. Devuelve las líneas y el tamaño elegido.
 */
export function ajustar(ctx, texto, { fuente, anchoMax, altoMax, tamMax, tamMin = 12, interlinea = 1.3 }) {
  let tam = tamMax;
  let lineas;
  for (; tam >= tamMin; tam -= 2) {
    ctx.font = fuente(tam);
    lineas = envolver(ctx, texto, anchoMax);
    if (lineas.length * tam * interlinea <= altoMax) break;
  }
  tam = Math.max(tam, tamMin);
  ctx.font = fuente(tam);
  lineas = envolver(ctx, texto, anchoMax);
  const maxLineas = Math.max(1, Math.floor(altoMax / (tam * interlinea)));
  if (lineas.length > maxLineas) {
    lineas = lineas.slice(0, maxLineas);
    lineas[maxLineas - 1] = lineas[maxLineas - 1].replace(/\s*\S*$/, ' …');
  }
  return { lineas, tam, alto: lineas.length * tam * interlinea };
}

function dibujarLineas(ctx, lineas, x, y, tam, interlinea = 1.3) {
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * tam * interlinea));
}

/** Marco vacío con el texto "Imagen pendiente". Se comparte entre todas las obras. */
export function texturaPendiente(texto) {
  const c = lienzo(512, 640);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#ebe7e0');
  g.addColorStop(1, '#d9d3c9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#b9b1a5';
  ctx.lineWidth = 4;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(36, 36, c.width - 72, c.height - 72);
  ctx.setLineDash([]);
  // Icono simple de "imagen": montañas y sol.
  ctx.fillStyle = '#c4bcb0';
  ctx.beginPath();
  ctx.arc(310, 250, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150, 360);
  ctx.lineTo(230, 260);
  ctx.lineTo(290, 330);
  ctx.lineTo(320, 300);
  ctx.lineTo(370, 360);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d7468';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const { lineas, tam } = ajustar(ctx, texto, {
    fuente: (t) => `italic ${t}px ${FUENTE_TITULO}`,
    anchoMax: 380, altoMax: 120, tamMax: 44, tamMin: 20,
  });
  dibujarLineas(ctx, lineas, c.width / 2, 400, tam);
  return texturaDesdeCanvas(c);
}

/** Etiqueta pequeña bajo cada cuadro (título de la obra). */
export function texturaEtiqueta(titulo, color) {
  const c = lienzo(512, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 10, c.height);
  ctx.fillStyle = '#2b2622';
  ctx.textBaseline = 'top';
  const { lineas, tam, alto } = ajustar(ctx, titulo, {
    fuente: (t) => `600 ${t}px ${FUENTE_TEXTO}`,
    anchoMax: 460, altoMax: 104, tamMax: 40, tamMin: 18, interlinea: 1.2,
  });
  dibujarLineas(ctx, lineas, 34, (c.height - alto) / 2 + tam * 0.08, tam, 1.2);
  return texturaDesdeCanvas(c);
}

/** Cédula de sala: placa con título y texto. */
export function texturaCedula(titulo, texto, color) {
  const c = lienzo(600, 800);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, 16);
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  const t = ajustar(ctx, titulo, {
    fuente: (s) => `bold ${s}px ${FUENTE_TITULO}`,
    anchoMax: 520, altoMax: 150, tamMax: 46, tamMin: 24, interlinea: 1.15,
  });
  dibujarLineas(ctx, t.lineas, 40, 56, t.tam, 1.15);
  const y = 56 + t.alto + 20;
  ctx.fillStyle = '#d8d2c8';
  ctx.fillRect(40, y, 120, 4);
  ctx.fillStyle = '#2b2622';
  const b = ajustar(ctx, texto, {
    fuente: (s) => `${s}px ${FUENTE_TEXTO}`,
    anchoMax: 520, altoMax: c.height - y - 70, tamMax: 34, tamMin: 16, interlinea: 1.4,
  });
  dibujarLineas(ctx, b.lineas, 40, y + 28, b.tam, 1.4);
  return texturaDesdeCanvas(c);
}

/** Panel grande con las preguntas de la sala. */
export function texturaPreguntas(titulo, preguntas, color) {
  const c = lienzo(1536, 720);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 22, c.height);
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `bold 68px ${FUENTE_TITULO}`;
  ctx.fillText(titulo, 90, 60);
  ctx.fillStyle = '#d8d2c8';
  ctx.fillRect(90, 156, 200, 5);

  const lista = preguntas.length ? preguntas : [''];
  const altoDisp = c.height - 200 - 50;
  let tam = 58;
  let bloques;
  for (; tam >= 20; tam -= 2) {
    ctx.font = `${tam}px ${FUENTE_TEXTO}`;
    bloques = lista.map((p) => envolver(ctx, p, c.width - 90 - 110 - 80));
    const alto = bloques.reduce((s, b) => s + b.length * tam * 1.35 + tam * 0.7, 0);
    if (alto <= altoDisp) break;
  }
  let y = 200;
  bloques.forEach((lineas, i) => {
    if (y > c.height - 50) return;
    ctx.fillStyle = color;
    ctx.font = `bold ${tam}px ${FUENTE_TITULO}`;
    ctx.fillText(`${i + 1}.`, 90, y);
    ctx.fillStyle = '#2b2622';
    ctx.font = `${tam}px ${FUENTE_TEXTO}`;
    dibujarLineas(ctx, lineas, 160, y, tam, 1.35);
    y += lineas.length * tam * 1.35 + tam * 0.7;
  });
  return texturaDesdeCanvas(c);
}

/** Título grande de sala (fondo transparente). */
export function texturaTituloSala(numero, titulo, color) {
  const c = lienzo(1600, 200);
  const ctx = c.getContext('2d');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const texto = numero ? `${numero}  ·  ${titulo}` : titulo;
  const { lineas, tam } = ajustar(ctx, texto, {
    fuente: (s) => `bold ${s}px ${FUENTE_TITULO}`,
    anchoMax: 1540, altoMax: 190, tamMax: 96, tamMin: 30, interlinea: 1.1,
  });
  ctx.fillStyle = color;
  const y0 = c.height / 2 - ((lineas.length - 1) * tam * 1.1) / 2;
  dibujarLineas(ctx, lineas, c.width / 2, y0, tam, 1.1);
  return texturaDesdeCanvas(c);
}

/** Cartel sobre una puerta que indica a qué sala lleva. */
export function texturaCartel(numero, titulo, color) {
  const c = lienzo(1024, 200);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2622';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, c.height - 14, c.width, 14);
  ctx.textBaseline = 'middle';
  let x = 40;
  if (numero) {
    ctx.font = `bold 64px ${FUENTE_TITULO}`;
    ctx.fillStyle = color;
    ctx.fillText(numero, x, 92);
    x += ctx.measureText(numero).width + 34;
  }
  ctx.fillStyle = '#fbfaf7';
  const { lineas, tam } = ajustar(ctx, titulo, {
    fuente: (s) => `${s}px ${FUENTE_TEXTO}`,
    anchoMax: c.width - x - 40, altoMax: 160, tamMax: 54, tamMin: 22, interlinea: 1.15,
  });
  const y0 = 92 - ((lineas.length - 1) * tam * 1.15) / 2;
  dibujarLineas(ctx, lineas, x, y0, tam, 1.15);
  return texturaDesdeCanvas(c);
}

/** Panel de bienvenida del vestíbulo. */
export function texturaBienvenida(museo, texto) {
  const c = lienzo(1600, 760);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#c9a25a';
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, c.width - 60, c.height - 60);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#2b2622';
  const t = ajustar(ctx, museo.titulo ?? '', {
    fuente: (s) => `bold ${s}px ${FUENTE_TITULO}`,
    anchoMax: 1400, altoMax: 220, tamMax: 110, tamMin: 40, interlinea: 1.1,
  });
  dibujarLineas(ctx, t.lineas, c.width / 2, 90, t.tam, 1.1);
  let y = 90 + t.alto + 20;
  ctx.fillStyle = '#a8792a';
  ctx.font = `italic 64px ${FUENTE_TITULO}`;
  ctx.fillText(museo.lema ?? '', c.width / 2, y);
  y += 110;
  ctx.fillStyle = '#d8d2c8';
  ctx.fillRect(c.width / 2 - 120, y, 240, 4);
  y += 40;
  ctx.fillStyle = '#4a433c';
  const b = ajustar(ctx, texto ?? '', {
    fuente: (s) => `${s}px ${FUENTE_TEXTO}`,
    anchoMax: 1300, altoMax: c.height - y - 70, tamMax: 42, tamMin: 20, interlinea: 1.4,
  });
  dibujarLineas(ctx, b.lineas, c.width / 2, y, b.tam, 1.4);
  return texturaDesdeCanvas(c);
}

/** Suelo de madera clara procedimental (sin archivos externos). */
export function texturaSuelo() {
  const c = lienzo(512, 512);
  const ctx = c.getContext('2d');
  const tablas = 8;
  const alto = c.height / tablas;
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < tablas; i++) {
    const tono = 200 + Math.floor(azar() * 18);
    ctx.fillStyle = `rgb(${tono}, ${tono - 30}, ${tono - 68})`;
    ctx.fillRect(0, i * alto, c.width, alto);
    for (let v = 0; v < 14; v++) {
      ctx.strokeStyle = `rgba(120, 85, 50, ${0.04 + azar() * 0.06})`;
      ctx.lineWidth = 1 + azar() * 2;
      const y = i * alto + azar() * alto;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(170, y + azar() * 6 - 3, 340, y + azar() * 6 - 3, 512, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(80, 55, 30, 0.35)';
    ctx.fillRect(0, i * alto, c.width, 2);
    const corte = azar() * c.width;
    ctx.fillRect(corte, i * alto, 2, alto);
  }
  const t = texturaDesdeCanvas(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Halo radial para la luz cálida del vestíbulo. */
export function texturaHalo(color = '255, 200, 120') {
  const c = lienzo(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, `rgba(${color}, 1)`);
  g.addColorStop(0.25, `rgba(${color}, 0.55)`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return texturaDesdeCanvas(c);
}

/** Carga una imagen y la reduce si supera MAX_TEXTURA. */
export function cargarTexturaImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      let fuente = img;
      const lado = Math.max(img.naturalWidth, img.naturalHeight);
      if (lado > MAX_TEXTURA) {
        const k = MAX_TEXTURA / lado;
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        fuente = c;
      }
      const t = new THREE.Texture(fuente);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = anisotropia;
      t.needsUpdate = true;
      resolve({ textura: t, ancho: fuente.width, alto: fuente.height });
    };
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}
