import { CELDA } from './mundo.js';

/**
 * Mapa pequeño en la esquina: dibuja el plano, resalta la sala actual y
 * muestra al visitante como una flecha. El número de cada sala es la tecla
 * que lleva a ella.
 */
export function crearMinimapa(canvas, lugares) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lado = canvas.clientWidth || 180;
  canvas.width = lado * dpr;
  canvas.height = lado * dpr;
  ctx.scale(dpr, dpr);

  const cols = Math.max(...lugares.map((l) => l.c)) + 1;
  const filas = Math.max(...lugares.map((l) => l.r)) + 1;
  const pad = 8;
  const celda = (lado - pad * 2) / Math.max(cols, filas);
  const ox = pad + (lado - pad * 2 - celda * cols) / 2;
  const oy = pad + (lado - pad * 2 - celda * filas) / 2;
  const aMapa = (x, z) => ({
    px: ox + (x / CELDA + 1 + 0.5) * celda,
    py: oy + (z / CELDA + 1 + 0.5) * celda,
  });

  return function dibujar(x, z, yaw, actual) {
    ctx.clearRect(0, 0, lado, lado);
    const hueco = 3;
    // Conexiones (puertas)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const l of lugares) {
      for (const destino of Object.values(l.puertas)) {
        const a = aMapa(l.x, l.z);
        const b = aMapa(destino.x, destino.z);
        const mx = (a.px + b.px) / 2;
        const my = (a.py + b.py) / 2;
        const w = a.px === b.px ? celda * 0.22 : hueco * 2 + 2;
        const h = a.px === b.px ? hueco * 2 + 2 : celda * 0.22;
        ctx.fillRect(mx - w / 2, my - h / 2, w, h);
      }
    }
    lugares.forEach((l, i) => {
      const x0 = ox + l.c * celda + hueco;
      const y0 = oy + l.r * celda + hueco;
      const s = celda - hueco * 2;
      const esActual = l === actual;
      ctx.globalAlpha = esActual ? 0.95 : 0.35;
      ctx.fillStyle = l.color;
      ctx.fillRect(x0, y0, s, s);
      ctx.globalAlpha = 1;
      if (esActual) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 1, y0 + 1, s - 2, s - 2);
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(celda * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), x0 + s / 2, y0 + s / 2);
    });
    // Visitante
    const p = aMapa(x, z);
    ctx.save();
    ctx.translate(p.px, p.py);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1c1916';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
}
