import { CELDA } from './museo/plano.js';

// Mapa pequeño en la esquina: celdas del recorrido, sala actual y posición.
export class Minimapa {
  constructor(lienzo, textoSala, plano, ui) {
    this.plano = plano;
    this.ui = ui;
    this.textoSala = textoSala;
    this.celda = 52;
    this.margen = 8;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.ancho = plano.columnas * this.celda + this.margen * 2;
    this.alto = plano.filas * this.celda + this.margen * 2;
    lienzo.width = this.ancho * ratio;
    lienzo.height = this.alto * ratio;
    this.ctx = lienzo.getContext('2d');
    this.ctx.scale(ratio, ratio);
    this.actual = undefined;
  }

  aPixel(x, z) {
    const { celda, margen } = this;
    return [margen + (x / CELDA + 0.5) * celda, margen + (this.plano.filas - 0.5 + z / CELDA) * celda];
  }

  dibujar(posicion, rumbo, celdaActual) {
    const { ctx, celda, plano } = this;
    ctx.clearRect(0, 0, this.ancho, this.alto);

    // Pasillos entre celdas consecutivas.
    ctx.strokeStyle = '#b9b2a5';
    ctx.lineWidth = 6;
    ctx.beginPath();
    plano.celdas.forEach((c, i) => {
      const [px, py] = this.aPixel(c.x, c.z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    for (const c of plano.celdas) {
      const [px, py] = this.aPixel(c.x, c.z);
      const color = c.sala?.color ?? '#c9a46c';
      const activa = c === celdaActual;
      const lado = celda - 8;
      ctx.globalAlpha = activa ? 1 : 0.28;
      ctx.fillStyle = color;
      ctx.fillRect(px - lado / 2, py - lado / 2, lado, lado);
      ctx.globalAlpha = 1;
      if (activa) {
        ctx.strokeStyle = '#22201d';
        ctx.lineWidth = 2;
        ctx.strokeRect(px - lado / 2, py - lado / 2, lado, lado);
      }
      ctx.fillStyle = activa ? '#ffffff' : '#22201d';
      ctx.font = "700 13px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(c.sala ? String(c.indice + 1) : '0', px - lado / 2 + 4, py - lado / 2 + 3);
    }

    // Visitante: flecha que apunta hacia donde mira.
    const [vx, vy] = this.aPixel(posicion.x, posicion.z);
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(rumbo);
    ctx.fillStyle = '#22201d';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (celdaActual !== this.actual) {
      this.actual = celdaActual;
      const sala = celdaActual?.sala;
      const etiqueta = sala ? sala.etiqueta ?? sala.id : this.ui.vestibulo;
      this.textoSala.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = `${this.ui.estasEn ?? ''} · ${etiqueta}`;
      b.style.color = sala?.color ?? '#a0612b';
      this.textoSala.append(b, document.createTextNode(sala ? sala.titulo : ''));
    }
  }
}
