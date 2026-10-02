import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  texturaPendiente, texturaEtiqueta, texturaCedula, texturaPreguntas,
  texturaTituloSala, texturaCartel, texturaBienvenida, texturaSuelo,
  texturaHalo, cargarTexturaImagen,
} from './texturas.js';

// ── Medidas (metros) ────────────────────────────────────────────────
export const CELDA = 12;          // lado de cada sala
const MURO_GROSOR = 0.3;
const MURO_ALTO = 4.5;
const PUERTA_ANCHO = 2.6;
const PUERTA_ALTO = 3.1;
const MITAD = CELDA / 2 - MURO_GROSOR / 2; // del centro a la cara interior del muro

// ── Plano del museo (cuadrícula 3×3) ───────────────────────────────
//      [1.2][1.3][1.4]
//      [1.1][ V ][1.5]
//           [Fin]
const VESTIBULO = { c: 1, r: 1 };
const POSICIONES_SALAS = [
  { c: 0, r: 1 }, // 1.1
  { c: 0, r: 0 }, // 1.2
  { c: 1, r: 0 }, // 1.3
  { c: 2, r: 0 }, // 1.4
  { c: 2, r: 1 }, // 1.5
  { c: 1, r: 2 }, // Conclusiones
];
// Puertas: índices de sala (-1 = vestíbulo). Recorrido: V→1.1→…→1.5→V→Final.
const PUERTAS = [[-1, 0], [0, 1], [1, 2], [2, 3], [3, 4], [4, -1], [-1, 5]];

const LADOS = {
  N: { dc: 0, dr: -1, normal: new THREE.Vector3(0, 0, 1), rotY: 0 },
  S: { dc: 0, dr: 1, normal: new THREE.Vector3(0, 0, -1), rotY: Math.PI },
  O: { dc: -1, dr: 0, normal: new THREE.Vector3(1, 0, 0), rotY: Math.PI / 2 },
  E: { dc: 1, dr: 0, normal: new THREE.Vector3(-1, 0, 0), rotY: -Math.PI / 2 },
};
const OPUESTO = { N: 'S', S: 'N', O: 'E', E: 'O' };

export const centroCelda = (c, r) => ({ x: (c - 1) * CELDA, z: (r - 1) * CELDA });

export function celdaDePosicion(x, z) {
  return { c: Math.round(x / CELDA) + 1, r: Math.round(z / CELDA) + 1 };
}

/** Clave única de la arista (muro) de una celda en un lado. */
function claveArista(c, r, lado) {
  switch (lado) {
    case 'N': return `h:${c}:${r}`;
    case 'S': return `h:${c}:${r + 1}`;
    case 'O': return `v:${c}:${r}`;
    case 'E': return `v:${c + 1}:${r}`;
  }
}

function ladoHacia(a, b) {
  for (const [lado, d] of Object.entries(LADOS)) {
    if (a.c + d.dc === b.c && a.r + d.dr === b.r) return lado;
  }
  return null;
}

/**
 * Construye todo el museo a partir del contenido.
 * Devuelve la escena armada, los colisionadores, los objetos clicables y la
 * información de cada sala (para el mapa y el teletransporte).
 */
export function construirMuseo(scene, contenido) {
  const ui = contenido.interfaz ?? {};
  const salasDatos = (contenido.salas ?? []).slice(0, POSICIONES_SALAS.length);
  if ((contenido.salas ?? []).length > POSICIONES_SALAS.length) {
    console.warn(`El museo tiene lugar para ${POSICIONES_SALAS.length} salas; se ignoran las demás.`);
  }

  // Lugares: índice 0 = vestíbulo, 1..n = salas.
  const lugares = [
    {
      tipo: 'vestibulo', ...VESTIBULO, color: '#C9A25A',
      numero: '', titulo: contenido.vestibulo?.titulo ?? '', datos: contenido.vestibulo ?? {},
    },
    ...salasDatos.map((s, i) => ({
      tipo: 'sala', ...POSICIONES_SALAS[i], color: s.color || '#888888',
      numero: s.numero ?? s.id ?? '', titulo: s.titulo ?? '', datos: s,
    })),
  ];
  for (const l of lugares) {
    Object.assign(l, centroCelda(l.c, l.r));
    l.puertas = {}; // lado -> lugar vecino
  }
  const lugarEn = new Map(lugares.map((l) => [`${l.c}:${l.r}`, l]));

  const puertasPorArista = new Map();
  for (const [ia, ib] of PUERTAS) {
    const a = lugares[ia + 1];
    const b = lugares[ib + 1];
    if (!a || !b) continue;
    const lado = ladoHacia(a, b);
    a.puertas[lado] = b;
    b.puertas[OPUESTO[lado]] = a;
    puertasPorArista.set(claveArista(a.c, a.r, lado), true);
  }

  const colisionadores = []; // { minX, maxX, minZ, maxZ } o { x, z, radio }
  const interactivos = [];
  const actualizables = [];

  // ── Materiales compartidos ──
  const matMuro = new THREE.MeshLambertMaterial({ color: 0xf3f0ea });
  const matTecho = new THREE.MeshLambertMaterial({ color: 0xfbfaf8 });
  const sueloTex = texturaSuelo();
  sueloTex.repeat.set(CELDA / 4, CELDA / 4);
  const matSuelo = new THREE.MeshLambertMaterial({ map: sueloTex });
  const matMarcoPuerta = new THREE.MeshLambertMaterial({ color: 0x5a4a3c });
  const matMarco = new THREE.MeshLambertMaterial({ color: 0x2b2622 });
  const matPasp = new THREE.MeshBasicMaterial({ color: 0xfbfaf7 });
  const matPendiente = new THREE.MeshBasicMaterial({ map: texturaPendiente(ui.imagenPendiente ?? '') });

  // ── Muros (una sola malla) ──
  const geosMuro = [];
  const geosMarco = [];
  const caja = (geos, w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    geos.push(g);
  };
  const aristasHechas = new Set();
  for (const l of lugares) {
    for (const lado of Object.keys(LADOS)) {
      const clave = claveArista(l.c, l.r, lado);
      if (aristasHechas.has(clave)) continue;
      aristasHechas.add(clave);
      const conPuerta = puertasPorArista.has(clave);
      const horizontal = lado === 'N' || lado === 'S';
      const d = LADOS[lado];
      // Centro de la arista
      const ax = l.x + (horizontal ? 0 : d.dc * CELDA / 2);
      const az = l.z + (horizontal ? d.dr * CELDA / 2 : 0);
      const largo = CELDA + MURO_GROSOR;
      const tramos = conPuerta
        ? [[-largo / 2, -PUERTA_ANCHO / 2], [PUERTA_ANCHO / 2, largo / 2]]
        : [[-largo / 2, largo / 2]];
      const pieza = (u0, u1, y0, y1, grosor, geos, colisiona) => {
        const lu = u1 - u0;
        const um = (u0 + u1) / 2;
        const [w, dd, x, z] = horizontal
          ? [lu, grosor, ax + um, az]
          : [grosor, lu, ax, az + um];
        caja(geos, w, y1 - y0, dd, x, (y0 + y1) / 2, z);
        if (colisiona) {
          colisionadores.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dd / 2, maxZ: z + dd / 2 });
        }
      };
      for (const [u0, u1] of tramos) pieza(u0, u1, 0, MURO_ALTO, MURO_GROSOR, geosMuro, true);
      if (conPuerta) {
        const p = PUERTA_ANCHO / 2;
        pieza(-p, p, PUERTA_ALTO, MURO_ALTO, MURO_GROSOR, geosMuro, false); // dintel
        // Marco de la puerta
        const mg = MURO_GROSOR + 0.08;
        pieza(-p - 0.14, -p, 0, PUERTA_ALTO + 0.14, mg, geosMarco, false);
        pieza(p, p + 0.14, 0, PUERTA_ALTO + 0.14, mg, geosMarco, false);
        pieza(-p, p, PUERTA_ALTO, PUERTA_ALTO + 0.14, mg, geosMarco, false);
      }
    }
  }
  const muros = new THREE.Mesh(mergeGeometries(geosMuro), matMuro);
  scene.add(muros);
  scene.add(new THREE.Mesh(mergeGeometries(geosMarco), matMarcoPuerta));

  // ── Suelo y techo ──
  const geoPlano = new THREE.PlaneGeometry(CELDA, CELDA);
  for (const l of lugares) {
    const suelo = new THREE.Mesh(geoPlano, matSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.set(l.x, 0, l.z);
    scene.add(suelo);
    const techo = new THREE.Mesh(geoPlano, matTecho);
    techo.rotation.x = Math.PI / 2;
    techo.position.set(l.x, MURO_ALTO, l.z);
    scene.add(techo);
  }

  // ── Utilidad para colgar objetos en la cara interior de un muro ──
  const colgar = (obj, lugar, lado, u, y, separacion = 0.02) => {
    const d = LADOS[lado];
    const ejeU = new THREE.Vector3(Math.cos(d.rotY), 0, -Math.sin(d.rotY));
    obj.position.set(lugar.x, y, lugar.z)
      .addScaledVector(d.normal, -MITAD + separacion)
      .addScaledVector(ejeU, u);
    obj.rotation.y = d.rotY;
    scene.add(obj);
    return obj;
  };

  const plano = (w, h, material) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  const basico = (map, extra = {}) => new THREE.MeshBasicMaterial({ map, ...extra });

  // ── Carteles sobre las puertas (indican a dónde llevan) ──
  for (const l of lugares) {
    for (const [lado, destino] of Object.entries(l.puertas)) {
      const cartel = plano(2.9, 0.57, basico(texturaCartel(destino.numero, destino.titulo, destino.color)));
      colgar(cartel, l, lado, 0, PUERTA_ALTO + 0.62, 0.03);
    }
  }

  // ── Luces ──
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcabba5, 2.2));
  const geoLampara = new THREE.PlaneGeometry(2.4, 2.4);
  const matLampara = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
  for (const l of lugares) {
    const luz = new THREE.PointLight(0xfff3e2, 12, CELDA * 1.2, 1.2);
    luz.position.set(l.x, 3.1, l.z);
    scene.add(luz);
    if (l.tipo === 'sala') {
      const lampara = new THREE.Mesh(geoLampara, matLampara);
      lampara.rotation.x = Math.PI / 2;
      lampara.position.set(l.x, MURO_ALTO - 0.01, l.z);
      scene.add(lampara);
    }
  }

  // ── Detalles de color de acento por sala (zócalo, franja alta, alfombra) ──
  const geoAlfombra = new THREE.PlaneGeometry(CELDA * 0.4, CELDA * 0.4);
  for (const l of lugares) {
    const color = new THREE.Color(l.color);
    const geos = [];
    for (const lado of Object.keys(LADOS)) {
      const d = LADOS[lado];
      const tramos = l.puertas[lado]
        ? [[-MITAD, -PUERTA_ANCHO / 2 - 0.14], [PUERTA_ANCHO / 2 + 0.14, MITAD]]
        : [[-MITAD, MITAD]];
      for (const [u0, u1] of tramos) {
        for (const [y, alto] of [[0.07, 0.14], [MURO_ALTO - 0.35, 0.06]]) {
          const g = new THREE.BoxGeometry(u1 - u0, alto, 0.03);
          g.rotateY(d.rotY);
          const ejeU = new THREE.Vector3(Math.cos(d.rotY), 0, -Math.sin(d.rotY));
          const p = new THREE.Vector3(l.x, y, l.z)
            .addScaledVector(d.normal, -MITAD + 0.015)
            .addScaledVector(ejeU, (u0 + u1) / 2);
          g.translate(p.x, p.y, p.z);
          geos.push(g);
        }
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({ color })));
    if (l.tipo === 'sala') {
      const alfombra = new THREE.Mesh(geoAlfombra, new THREE.MeshLambertMaterial({
        color, transparent: true, opacity: 0.13, depthWrite: false,
      }));
      alfombra.rotation.x = -Math.PI / 2;
      alfombra.position.set(l.x, 0.005, l.z);
      scene.add(alfombra);
    }
  }

  // ── Vestíbulo: luz cálida central y bienvenida ──
  construirVestibulo(scene, lugares[0], contenido, colgar, colisionadores, actualizables);

  // ── Salas ──
  for (const l of lugares.slice(1)) {
    construirSala(l, { ui, colgar, plano, basico, matMarco, matPasp, matPendiente, interactivos });
  }

  // ── Punto de aparición de cada lugar (para teletransportar) ──
  for (const l of lugares) {
    const d = LADOS[l.ladoPrincipal];
    const atras = d.normal.clone(); // la normal apunta hacia dentro de la sala
    l.aparicion = {
      x: l.x + atras.x * CELDA * 0.3,
      z: l.z + atras.z * CELDA * 0.3,
      yaw: d.rotY, // mirando hacia el muro principal
    };
  }

  return { lugares, lugarEn, colisionadores, interactivos, ocluyentes: [muros], actualizables };
}

/** Elige el muro sin puerta que se ve al entrar (opuesto a una puerta). */
function elegirMuroPrincipal(lugar) {
  const libres = Object.keys(LADOS).filter((lado) => !lugar.puertas[lado]);
  return libres.find((lado) => lugar.puertas[OPUESTO[lado]]) ?? libres[0] ?? 'N';
}

function construirVestibulo(scene, v, contenido, colgar, colisionadores, actualizables) {
  v.ladoPrincipal = elegirMuroPrincipal(v);
  const bienvenida = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 3.23),
    new THREE.MeshBasicMaterial({ map: texturaBienvenida(contenido.museo ?? {}, contenido.vestibulo?.texto) }),
  );
  colgar(bienvenida, v, v.ladoPrincipal, 0, 2.4, 0.03);

  // Pedestal con una esfera luminosa.
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, 0.8, 24),
    new THREE.MeshLambertMaterial({ color: 0xe9e2d6 }),
  );
  pedestal.position.set(v.x, 0.4, v.z);
  scene.add(pedestal);
  const esfera = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe2b0 }),
  );
  esfera.position.set(v.x, 1.12, v.z);
  scene.add(esfera);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texturaHalo(), color: 0xffc070, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(1.8, 1.8, 1);
  halo.position.copy(esfera.position);
  scene.add(halo);
  const resplandor = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({
      map: texturaHalo(), color: 0xffb060, transparent: true, opacity: 0.12,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  resplandor.rotation.x = -Math.PI / 2;
  resplandor.position.set(v.x, 0.01, v.z);
  scene.add(resplandor);
  // Óculo en el techo, sobre la luz.
  const oculo = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffeacc }),
  );
  oculo.rotation.x = Math.PI / 2;
  oculo.position.set(v.x, MURO_ALTO - 0.01, v.z);
  scene.add(oculo);

  const luz = new THREE.PointLight(0xffbe78, 6, CELDA, 1.4);
  luz.position.set(v.x, 1.6, v.z);
  scene.add(luz);
  colisionadores.push({ x: v.x, z: v.z, radio: 0.65 });

  actualizables.push((t) => {
    const k = 1 + Math.sin(t * 1.3) * 0.08;
    luz.intensity = 6 * k;
    halo.scale.setScalar(1.8 * k);
  });
}

function construirSala(l, { ui, colgar, plano, basico, matMarco, matPasp, matPendiente, interactivos }) {
  const sala = l.datos;
  l.ladoPrincipal = elegirMuroPrincipal(l);

  // Título y panel de preguntas en el muro principal.
  colgar(plano(8.5, 1.06, basico(texturaTituloSala(l.numero, l.titulo, l.color), { transparent: true })),
    l, l.ladoPrincipal, 0, 3.72, 0.03);
  const preguntas = sala.preguntas ?? [];
  const panel = plano(5.6, 2.625, basico(texturaPreguntas(ui.preguntasTitulo ?? '', preguntas, l.color)));
  colgar(panel, l, l.ladoPrincipal, 0, 1.85, 0.04);
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(5.72, 2.745, 0.04), matMarco);
  colgar(fondo, l, l.ladoPrincipal, 0, 1.85, 0.02);
  panel.userData.interactivo = { tipo: 'preguntas', lugar: l, alcance: 7 };
  interactivos.push(panel);

  // Tramos de muro disponibles para colgar.
  const ANCHO_PANEL = 5.72;
  const margen = 0.6;
  const tramosLaterales = [];
  const tramosObras = [];
  for (const lado of Object.keys(LADOS)) {
    if (lado === l.ladoPrincipal) {
      tramosLaterales.push({ lado, u0: -MITAD + margen, u1: -ANCHO_PANEL / 2 - 0.5 });
      tramosLaterales.push({ lado, u0: ANCHO_PANEL / 2 + 0.5, u1: MITAD - margen });
    } else if (l.puertas[lado]) {
      tramosObras.push({ lado, u0: -MITAD + margen, u1: -PUERTA_ANCHO / 2 - 0.6 });
      tramosObras.push({ lado, u0: PUERTA_ANCHO / 2 + 0.6, u1: MITAD - margen });
    } else {
      // Muros enteros primero: lucen mejor para las obras.
      tramosObras.unshift({ lado, u0: -MITAD + margen, u1: MITAD - margen });
    }
  }

  const obras = sala.obras ?? [];
  const cedulas = sala.cedulas ?? [];
  // Las cédulas van junto al panel de preguntas; si sobran, al resto de muros.
  const asign = repartir(cedulas.length, tramosLaterales, 1.6);
  const sobrantes = cedulas.length - asign.reduce((s, a) => s + a.n, 0);
  const asignObras = repartir(obras.length + sobrantes, tramosObras, 2.6);

  let ic = 0;
  for (const a of asign) {
    for (const u of posiciones(a)) crearCedula(cedulas[ic++], u, a.tramo.lado);
  }
  let io = 0;
  for (const a of asignObras) {
    for (const u of posiciones(a)) {
      if (io < obras.length) crearObra(obras[io++], u, a.tramo.lado);
      else crearCedula(cedulas[ic++], u, a.tramo.lado);
    }
  }
  if (io < obras.length || ic < cedulas.length) {
    console.warn(`Sala ${l.numero}: no hay lugar en los muros para todas las obras/cédulas.`);
  }

  function crearCedula(c, u, lado) {
    if (!c) return;
    const placa = plano(1.2, 1.6, basico(texturaCedula(c.titulo ?? '', c.texto ?? '', l.color)));
    colgar(placa, l, lado, u, 1.6, 0.04);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.66, 0.04), matMarco);
    colgar(base, l, lado, u, 1.6, 0.02);
    placa.userData.interactivo = { tipo: 'cedula', lugar: l, cedula: c, alcance: 5 };
    interactivos.push(placa);
  }

  function crearObra(o, u, lado) {
    if (!o) return;
    const grupo = new THREE.Group();
    const marco = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.07), matMarco);
    marco.position.z = 0.035;
    const pasp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matPasp);
    pasp.position.z = 0.071;
    const imagen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matPendiente);
    imagen.position.z = 0.072;
    const etiqueta = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.25),
      new THREE.MeshBasicMaterial({ map: texturaEtiqueta(o.titulo ?? '', l.color) }),
    );
    etiqueta.position.z = 0.005;
    grupo.add(marco, pasp, imagen, etiqueta);

    const ALTO_CENTRO = 1.7;
    const dimensionar = (w, h) => {
      imagen.scale.set(w, h, 1);
      pasp.scale.set(w + 0.14, h + 0.14, 1);
      marco.scale.set(w + 0.26, h + 0.26, 1);
      etiqueta.position.set(0, -h / 2 - 0.13 - 0.3, 0.005);
    };
    dimensionar(1.1, 1.4);
    colgar(grupo, l, lado, u, ALTO_CENTRO, 0.0);

    const info = { tipo: 'obra', lugar: l, obra: o, alcance: 4.5 };
    for (const m of [marco, imagen, etiqueta]) {
      m.userData.interactivo = info;
      interactivos.push(m);
    }

    if (o.imagen) {
      cargarTexturaImagen(o.imagen).then(({ textura, ancho, alto }) => {
        const MAX_W = 2.0;
        const MAX_H = 1.5;
        const k = Math.min(MAX_W / ancho, MAX_H / alto);
        imagen.material = new THREE.MeshBasicMaterial({ map: textura });
        dimensionar(ancho * k, alto * k);
        info.imagenCargada = true;
      }).catch((e) => console.warn(e.message));
    }
  }
}

/** Reparte `n` elementos entre tramos, por turnos, respetando su capacidad. */
function repartir(n, tramos, anchoElem) {
  const asign = tramos.map((tramo) => ({
    tramo, n: 0, cap: Math.max(0, Math.floor((tramo.u1 - tramo.u0 + 0.6) / anchoElem)),
  }));
  let quedan = n;
  while (quedan > 0) {
    let puso = false;
    for (const a of asign) {
      if (quedan > 0 && a.n < a.cap) {
        a.n++;
        quedan--;
        puso = true;
      }
    }
    if (!puso) break;
  }
  return asign.filter((a) => a.n > 0);
}

/** Posiciones equiespaciadas de los elementos dentro de un tramo. */
function posiciones({ tramo, n }) {
  const largo = tramo.u1 - tramo.u0;
  return Array.from({ length: n }, (_, i) => tramo.u0 + (largo * (i + 0.5)) / n);
}
