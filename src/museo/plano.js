// Plano del museo: una cuadrícula de celdas cuadradas.
// El vestíbulo ocupa la celda (0, 0) y las salas siguen un recorrido en
// zigzag de 3 columnas hacia el norte. Cada celda tiene una puerta hacia la
// anterior y la siguiente del recorrido.

export const CELDA = 16; // lado de cada sala (m)
export const ALTO = 6; // altura de las paredes (m)
export const GROSOR = 0.4; // grosor de los muros (m)
export const PUERTA_ANCHO = 3.2;
export const PUERTA_ALTO = 3.6;
export const ALTURA_OJOS = 1.65;
const COLUMNAS = 3;

// theta: rotación en Y de un plano para que mire hacia el interior de la sala
// desde ese muro. "dr" positivo es hacia el norte (-z).
export const DIRECCIONES = {
  N: { dc: 0, dr: 1, theta: 0 },
  S: { dc: 0, dr: -1, theta: Math.PI },
  E: { dc: 1, dr: 0, theta: -Math.PI / 2 },
  O: { dc: -1, dr: 0, theta: Math.PI / 2 },
};
const OPUESTA = { N: 'S', S: 'N', E: 'O', O: 'E' };

export function crearPlano(salas) {
  const celdas = [{ indice: -1, sala: null, col: 0, fila: 0 }];
  salas.forEach((sala, i) => {
    const tramo = Math.floor(i / COLUMNAS);
    const k = i % COLUMNAS;
    celdas.push({ indice: i, sala, col: tramo % 2 === 0 ? k : COLUMNAS - 1 - k, fila: tramo + 1 });
  });

  const porClave = new Map();
  celdas.forEach((c, orden) => {
    c.orden = orden;
    c.x = c.col * CELDA;
    c.z = -c.fila * CELDA;
    c.puertas = {};
    porClave.set(`${c.col},${c.fila}`, c);
  });

  for (let i = 1; i < celdas.length; i++) {
    const a = celdas[i - 1];
    const b = celdas[i];
    const dir = Object.keys(DIRECCIONES).find(
      (d) => a.col + DIRECCIONES[d].dc === b.col && a.fila + DIRECCIONES[d].dr === b.fila,
    );
    a.puertas[dir] = b;
    b.puertas[OPUESTA[dir]] = a;
  }

  const filas = Math.max(...celdas.map((c) => c.fila)) + 1;
  return {
    celdas,
    columnas: COLUMNAS,
    filas,
    vecina: (c, dir) => porClave.get(`${c.col + DIRECCIONES[dir].dc},${c.fila + DIRECCIONES[dir].dr}`),
    celdaEn(x, z) {
      return porClave.get(`${Math.round(x / CELDA)},${Math.round(-z / CELDA)}`) ?? null;
    },
  };
}

export { OPUESTA };
