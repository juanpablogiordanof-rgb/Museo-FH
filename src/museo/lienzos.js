import * as THREE from 'three';

// Texturas generadas con <canvas>: textos de paredes, cartelas y marcadores.
// Ningún lienzo supera los 1600 px de lado.

export const TEXTURA_MAX = 1600;

const FAMILIAS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
};

let anisotropia = 1;
export function configurarAnisotropia(valor) {
  anisotropia = Math.min(4, valor);
}

export function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = Math.min(TEXTURA_MAX, Math.round(ancho));
  c.height = Math.min(TEXTURA_MAX, Math.round(alto));
  return c;
}

export function textura(fuente) {
  const t = new THREE.Texture(fuente);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  t.needsUpdate = true;
  return t;
}

// Reduce una imagen a TEXTURA_MAX px de lado como máximo.
export function limitarImagen(img) {
  const lado = Math.max(img.naturalWidth, img.naturalHeight);
  if (lado <= TEXTURA_MAX) return img;
  const k = TEXTURA_MAX / lado;
  const c = lienzo(img.naturalWidth * k, img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function fuenteDe(b, escala) {
  return `${b.italica ? 'italic ' : ''}${b.peso ?? 400} ${Math.round(b.tam * escala)}px ${FAMILIAS[b.familia ?? 'sans']}`;
}

export function envolver(ctx, texto, anchoMax) {
  const lineas = [];
  for (const parrafo of String(texto ?? '').split('\n')) {
    let linea = '';
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = linea ? `${linea} ${palabra}` : palabra;
      if (linea && ctx.measureText(prueba).width > anchoMax) {
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

function maquetar(ctx, bloques, ancho, escala) {
  let alto = 0;
  const partes = bloques.map((b) => {
    ctx.font = fuenteDe(b, escala);
    const sangria = (b.sangria ?? 0) * escala;
    const lineas = envolver(ctx, b.texto, ancho - sangria);
    const salto = b.tam * escala * (b.interlineado ?? 1.3);
    const parte = { b, lineas, salto, sangria, y: alto };
    alto += lineas.length * salto + (b.espacio ?? 0) * escala;
    return parte;
  });
  return { partes, alto };
}

// Dibuja bloques de texto dentro de una caja, reduciendo el tamaño de letra
// hasta que todo quepa. Bloque: { texto, tam, peso, familia, color, alinear,
// italica, interlineado, espacio (después), sangria, vineta }.
export function componer(ctx, bloques, x, y, ancho, altoMax, { centrarVertical = false } = {}) {
  let escala = 1;
  let m = maquetar(ctx, bloques, ancho, escala);
  while (m.alto > altoMax && escala > 0.35) {
    escala -= 0.05;
    m = maquetar(ctx, bloques, ancho, escala);
  }
  const y0 = centrarVertical ? y + Math.max(0, (altoMax - m.alto) / 2) : y;
  ctx.textBaseline = 'top';
  for (const { b, lineas, salto, sangria, y: yb } of m.partes) {
    ctx.font = fuenteDe(b, escala);
    ctx.fillStyle = b.color ?? '#22201d';
    ctx.textAlign = b.alinear ?? 'left';
    const xb = b.alinear === 'center' ? x + ancho / 2 : b.alinear === 'right' ? x + ancho : x + sangria;
    if (b.vineta) {
      ctx.save();
      ctx.font = fuenteDe({ ...b, peso: 700 }, escala);
      ctx.fillStyle = b.colorVineta ?? b.color;
      ctx.textAlign = 'left';
      ctx.fillText(b.vineta, x, y0 + yb);
      ctx.restore();
    }
    lineas.forEach((l, i) => ctx.fillText(l, xb, y0 + yb + i * salto));
  }
  return m.alto;
}

export function tramado(ctx, ancho, alto, fondo, linea) {
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.strokeStyle = linea;
  ctx.lineWidth = 2;
  for (let d = -alto; d < ancho; d += 28) {
    ctx.beginPath();
    ctx.moveTo(d, alto);
    ctx.lineTo(d + alto, 0);
    ctx.stroke();
  }
}

export function texturaSuelo() {
  const c = lienzo(512, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4dfd6';
  ctx.fillRect(0, 0, 512, 512);
  // Veteado suave de piedra caliza.
  let s = 7;
  const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = 212 + Math.floor(azar() * 28);
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`;
    ctx.fillRect(azar() * 512, azar() * 512, 1 + azar() * 3, 1 + azar() * 3);
  }
  ctx.strokeStyle = 'rgba(170,162,148,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, 509, 509);
  const t = textura(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function texturaResplandor(color) {
  const c = lienzo(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return textura(c);
}
