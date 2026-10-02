import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CELDA, ALTO, GROSOR, PUERTA_ANCHO, PUERTA_ALTO, ALTURA_OJOS, DIRECCIONES, OPUESTA,
} from './plano.js';
import {
  lienzo, textura, limitarImagen, componer, tramado, texturaSuelo, texturaResplandor,
} from './lienzos.js';

const ORDEN_DIRS = ['N', 'E', 'S', 'O'];
const ALTURA_CUADROS = 1.75;
const COLOR_TINTA = '#22201d';
const COLOR_TENUE = '#6b655b';
const COLOR_CALIDO = '#a0612b';

const geomPlano = new THREE.PlaneGeometry(1, 1);
const geomMarco = new THREE.BoxGeometry(1, 1, 0.06);
const ayudante = new THREE.Object3D();

// Material para paneles de texto: iluminado como la pared, pero con un
// mínimo de luz propia para que siempre se lea bien.
function materialPanel(tex, { transparente = false, brillo = 0.4 } = {}) {
  return new THREE.MeshLambertMaterial({
    map: tex,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: brillo,
    transparent: transparente,
    depthWrite: !transparente,
  });
}

function planoTexto(canvas, ancho, opciones) {
  const malla = new THREE.Mesh(geomPlano, materialPanel(textura(canvas), opciones));
  malla.scale.set(ancho, ancho * (canvas.height / canvas.width), 1);
  return malla;
}

function cargarImagen(src) {
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolver(img);
    img.onerror = rechazar;
    img.src = src;
  });
}

function mezclar(hex, conHex, t) {
  return new THREE.Color(hex).lerp(new THREE.Color(conHex), t);
}

export function construirMuseo({ escena, plano, contenido }) {
  const { museo, ui, salas } = contenido;
  const colisionadores = [];
  const clicables = [];
  const geoms = { muros: [], suelo: [], techo: [], lucernario: [] };
  const geomsAcento = new Map(); // color -> geometrías (zócalos, marcos de puerta, filetes)

  const mats = {
    muro: new THREE.MeshLambertMaterial({ color: 0xf2f0eb }),
    suelo: new THREE.MeshLambertMaterial({ map: texturaSuelo(), color: 0xf1eee8 }),
    techo: new THREE.MeshLambertMaterial({ color: 0xf6f5f2, emissive: 0x6f6d69 }),
    lucernario: new THREE.MeshBasicMaterial({ color: 0xfbfcfd }),
    marco: new THREE.MeshLambertMaterial({ color: 0x2b2926 }),
    paspartu: new THREE.MeshLambertMaterial({ color: 0xfbfaf7, emissive: 0xffffff, emissiveIntensity: 0.15 }),
  };
  mats.suelo.map.repeat.set(CELDA / 2, CELDA / 2);

  function acento(color, geom) {
    if (!geomsAcento.has(color)) geomsAcento.set(color, []);
    geomsAcento.get(color).push(geom);
  }

  // Aplica posición y rotación a una geometría para fusionarla después.
  function fijar(geom, x, y, z, rotY = 0, rotX = 0) {
    ayudante.position.set(x, y, z);
    ayudante.rotation.set(rotX, rotY, 0);
    ayudante.updateMatrix();
    return geom.applyMatrix4(ayudante.matrix);
  }

  function marcarClicable(objeto, ficha) {
    objeto.traverse((o) => {
      if (o.isMesh) {
        o.userData.ficha = ficha;
        clicables.push(o);
      }
    });
  }

  // ---------- Muros (compartidos entre celdas) ----------
  const hechos = new Set();
  for (const c of plano.celdas) {
    for (const dir of ORDEN_DIRS) {
      const v = plano.vecina(c, dir);
      const clave = v ? [c.orden, v.orden].sort((a, b) => a - b).join('-') : `${c.orden}${dir}`;
      if (hechos.has(clave)) continue;
      hechos.add(clave);
      construirMuro(c, dir, c.puertas[dir]);
    }
  }

  function construirMuro(c, dir, destino) {
    const L = CELDA + GROSOR;
    const enX = dir === 'N' || dir === 'S';
    const fijo = enX
      ? c.z + (dir === 'N' ? -CELDA / 2 : CELDA / 2)
      : c.x + (dir === 'E' ? CELDA / 2 : -CELDA / 2);
    const centro = enX ? c.x : c.z;
    const m = PUERTA_ANCHO / 2;
    const tramos = destino
      ? [[centro - L / 2, centro - m, 0, ALTO], [centro + m, centro + L / 2, 0, ALTO], [centro - m, centro + m, PUERTA_ALTO, ALTO]]
      : [[centro - L / 2, centro + L / 2, 0, ALTO]];

    for (const [a, b, y0, y1] of tramos) {
      const g = new THREE.BoxGeometry(enX ? b - a : GROSOR, y1 - y0, enX ? GROSOR : b - a);
      geoms.muros.push(fijar(g, enX ? (a + b) / 2 : fijo, (y0 + y1) / 2, enX ? fijo : (a + b) / 2));
      if (y0 === 0) {
        colisionadores.push(enX
          ? { minX: a, maxX: b, minZ: fijo - GROSOR / 2, maxZ: fijo + GROSOR / 2 }
          : { minX: fijo - GROSOR / 2, maxX: fijo + GROSOR / 2, minZ: a, maxZ: b });
      }
    }

    if (destino) {
      // Marco de la puerta con el color de la sala más avanzada del recorrido.
      const posterior = destino.orden > c.orden ? destino : c;
      const color = posterior.sala?.color ?? '#d6a35c';
      const e = 0.07;
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(enX ? e : GROSOR + 0.04, PUERTA_ALTO, enX ? GROSOR + 0.04 : e);
        const pos = centro + s * (m - e / 2);
        acento(color, fijar(g, enX ? pos : fijo, PUERTA_ALTO / 2, enX ? fijo : pos));
      }
      const g = new THREE.BoxGeometry(enX ? PUERTA_ANCHO : GROSOR + 0.04, e, enX ? GROSOR + 0.04 : PUERTA_ANCHO);
      acento(color, fijar(g, enX ? centro : fijo, PUERTA_ALTO - e / 2, enX ? fijo : centro));
    }
  }

  // ---------- Paredes interiores de cada celda ----------
  function pared(c, dir) {
    const { theta } = DIRECCIONES[dir];
    const normal = new THREE.Vector3(Math.sin(theta), 0, Math.cos(theta));
    const derecha = new THREE.Vector3(Math.cos(theta), 0, -Math.sin(theta));
    const centro = new THREE.Vector3(c.x, 0, c.z).addScaledVector(normal, -(CELDA / 2 - GROSOR / 2));
    const mitad = CELDA / 2 - GROSOR / 2;
    const destino = c.puertas[dir] ?? null;
    const hueco = PUERTA_ANCHO / 2 + 0.45;
    const intervalos = destino ? [[-mitad, -hueco], [hueco, mitad]] : [[-mitad, mitad]];
    return { dir, theta, normal, derecha, centro, destino, intervalos };
  }

  function colocar(objeto, p, t, y, separacion = 0.03) {
    objeto.position.copy(p.centro).addScaledVector(p.derecha, t).addScaledVector(p.normal, separacion);
    objeto.position.y = y;
    objeto.rotation.y = p.theta;
    escena.add(objeto);
    return objeto;
  }

  function nombreDe(celda) {
    return celda.sala ? celda.sala.etiqueta ?? celda.sala.id : ui.vestibulo;
  }

  function letreroPuerta(c, p) {
    const destino = p.destino;
    const color = destino.sala?.color ?? COLOR_CALIDO;
    const canvas = lienzo(1400, 300);
    const ctx = canvas.getContext('2d');
    const bloques = [];
    if (c.indice === -1 && destino.indice === 0 && ui.comienzo) {
      bloques.push({ texto: ui.comienzo.toUpperCase(), tam: 40, peso: 600, color: COLOR_TENUE, alinear: 'center', espacio: 6 });
    }
    bloques.push({ texto: nombreDe(destino).toUpperCase(), tam: 52, peso: 700, color, alinear: 'center', espacio: 8 });
    if (destino.sala) bloques.push({ texto: destino.sala.titulo, tam: 66, familia: 'serif', color: COLOR_TINTA, alinear: 'center', interlineado: 1.15 });
    componer(ctx, bloques, 20, 10, 1360, 280, { centrarVertical: true });
    colocar(planoTexto(canvas, 4.6, { transparente: true }), p, 0, (PUERTA_ALTO + ALTO) / 2);
  }

  function zocalos(p, color) {
    for (const [a, b] of p.intervalos) {
      const largo = b - a;
      const g = new THREE.BoxGeometry(largo, 0.14, 0.03);
      const pos = p.centro.clone().addScaledVector(p.derecha, (a + b) / 2).addScaledVector(p.normal, 0.015);
      acento(color, fijar(g, pos.x, 0.07, pos.z, p.theta));
    }
  }

  // Cartela pequeña bajo cada cuadro.
  function cartela(obra, sala) {
    const canvas = lienzo(640, 150);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, 640, 150);
    ctx.fillStyle = sala.color;
    ctx.fillRect(0, 0, 10, 150);
    componer(ctx, [
      { texto: obra.titulo, tam: 38, familia: 'serif', color: COLOR_TINTA, interlineado: 1.15, espacio: 8 },
      { texto: ui.pistaObra, tam: 24, color: COLOR_TENUE },
    ], 34, 18, 580, 116, { centrarVertical: true });
    return planoTexto(canvas, 1.25, { brillo: 0.45 });
  }

  let texPendiente = null;
  function texturaPendiente() {
    if (texPendiente) return texPendiente;
    const canvas = lienzo(800, 600);
    const ctx = canvas.getContext('2d');
    tramado(ctx, 800, 600, '#ebe8e1', '#e2ded5');
    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = '#b9b2a5';
    ctx.lineWidth = 4;
    ctx.strokeRect(40, 40, 720, 520);
    ctx.setLineDash([]);
    componer(ctx, [{ texto: ui.imagenPendiente, tam: 64, familia: 'serif', italica: true, color: '#8b857a', alinear: 'center' }], 60, 60, 680, 480, { centrarVertical: true });
    texPendiente = textura(canvas);
    return texPendiente;
  }

  function crearObra(obra, sala, p, t, anchoMax) {
    const grupo = new THREE.Group();
    const marco = new THREE.Mesh(geomMarco, mats.marco);
    const paspartu = new THREE.Mesh(geomPlano, mats.paspartu);
    const lamina = new THREE.Mesh(geomPlano, materialPanel(texturaPendiente(), { brillo: 0.3 }));
    const etiqueta = cartela(obra, sala);
    marco.position.z = 0.03;
    paspartu.position.z = 0.062;
    lamina.position.z = 0.064;
    grupo.add(marco, paspartu, lamina, etiqueta);

    const ajustar = (w, h) => {
      marco.scale.set(w + 0.24, h + 0.24, 1);
      paspartu.scale.set(w + 0.12, h + 0.12, 1);
      lamina.scale.set(w, h, 1);
      etiqueta.position.set(0, -(h / 2 + 0.12 + 0.2 + etiqueta.scale.y / 2), 0.02);
    };
    const encajar = (aspecto) => {
      const maxH = 1.7;
      return aspecto > anchoMax / maxH ? [anchoMax, anchoMax / aspecto] : [maxH * aspecto, maxH];
    };
    ajustar(...encajar(4 / 3).map((v) => Math.min(v, 1.6)));

    const ficha = { tipo: 'obra', sala, titulo: obra.titulo, texto: obra.nota, imagen: null };
    marcarClicable(grupo, ficha);
    colocar(grupo, p, t, ALTURA_CUADROS + 0.15, 0.01);

    if (obra.imagen) {
      cargarImagen(obra.imagen)
        .then((img) => {
          const tex = textura(limitarImagen(img));
          lamina.material.map = tex;
          lamina.material.emissiveMap = tex;
          lamina.material.emissiveIntensity = 0.2;
          lamina.material.needsUpdate = true;
          ajustar(...encajar(img.naturalWidth / img.naturalHeight));
          ficha.imagen = obra.imagen;
        })
        .catch(() => console.warn(`No se pudo cargar la imagen: ${obra.imagen}`));
    }
  }

  function crearCedula(cedula, sala, p, t) {
    const canvas = lienzo(600, 800);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, 600, 800);
    ctx.fillStyle = sala.color;
    ctx.fillRect(0, 0, 600, 16);
    componer(ctx, [
      { texto: (sala.etiqueta ?? sala.id).toUpperCase(), tam: 24, peso: 700, color: sala.color, espacio: 18 },
      { texto: cedula.titulo, tam: 46, familia: 'serif', color: COLOR_TINTA, interlineado: 1.15, espacio: 26 },
      { texto: cedula.texto, tam: 29, color: '#3b3732', interlineado: 1.45 },
    ], 48, 60, 504, 640);
    ctx.fillStyle = COLOR_TENUE;
    ctx.font = "24px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(ui.pistaPanel, 48, 745);
    const malla = planoTexto(canvas, 1.6);
    marcarClicable(malla, { tipo: 'cedula', sala, titulo: cedula.titulo, texto: cedula.texto });
    colocar(malla, p, t, ALTURA_CUADROS + 0.05);
  }

  function crearPreguntas(sala, p) {
    const canvas = lienzo(1500, 980);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fbfaf6';
    ctx.fillRect(0, 0, 1500, 980);
    const bloques = [{ texto: ui.tituloPreguntas, tam: 88, familia: 'serif', color: sala.color, espacio: 40 }];
    (sala.preguntas ?? []).forEach((q, i) => bloques.push({
      texto: q, tam: 56, color: COLOR_TINTA, interlineado: 1.3, espacio: 32, sangria: 80, vineta: `${i + 1}`, colorVineta: sala.color,
    }));
    componer(ctx, bloques, 90, 80, 1320, 780);
    ctx.fillStyle = COLOR_TENUE;
    ctx.font = "28px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(ui.pistaPanel, 90, 900);

    const panel = planoTexto(canvas, 4.6, { brillo: 0.45 });
    const fondo = new THREE.Mesh(geomPlano, new THREE.MeshLambertMaterial({ color: sala.color }));
    fondo.scale.set(4.6 + 0.2, panel.scale.y + 0.2, 1);
    fondo.position.z = -0.01;
    const grupo = new THREE.Group();
    grupo.add(fondo, panel);
    marcarClicable(grupo, { tipo: 'preguntas', sala, titulo: ui.tituloPreguntas, preguntas: sala.preguntas ?? [] });
    colocar(grupo, p, 0, 2.05);

    // Título de la sala sobre el panel.
    const tc = lienzo(1600, 300);
    const tctx = tc.getContext('2d');
    componer(tctx, [
      { texto: (sala.etiqueta ?? sala.id).toUpperCase(), tam: 54, peso: 700, color: sala.color, alinear: 'center', espacio: 14 },
      { texto: sala.titulo, tam: 100, familia: 'serif', color: COLOR_TINTA, alinear: 'center', interlineado: 1.1 },
    ], 20, 10, 1560, 280, { centrarVertical: true });
    colocar(planoTexto(tc, 10, { transparente: true }), p, 0, 4.75);
  }

  function huecos(intervalos, ancho) {
    const lista = [];
    for (const [a, b] of intervalos) {
      const n = Math.floor((b - a) / ancho);
      if (n < 1) continue;
      const paso = (b - a) / n;
      for (let i = 0; i < n; i++) lista.push({ t: a + paso * (i + 0.5), ancho: paso });
    }
    return lista;
  }

  function amueblarSala(c) {
    const { sala } = c;
    const paredes = Object.fromEntries(ORDEN_DIRS.map((d) => [d, pared(c, d)]));
    const entrada = ORDEN_DIRS.find((d) => c.puertas[d]?.orden === c.orden - 1);
    const libres = ORDEN_DIRS.filter((d) => !c.puertas[d]);
    const dirPreg = !c.puertas[OPUESTA[entrada]] ? OPUESTA[entrada] : libres[0] ?? OPUESTA[entrada];
    const pPreg = paredes[dirPreg];

    for (const p of Object.values(paredes)) {
      zocalos(p, sala.color);
      if (p.destino) letreroPuerta(c, p);
    }
    crearPreguntas(sala, pPreg);

    // Huecos libres: los laterales del panel de preguntas y el resto de muros,
    // recorridos en sentido horario desde la entrada.
    const reservado = 2.85;
    const intervalosPreg = pPreg.intervalos.flatMap(([a, b]) => [[a, Math.min(b, -reservado)], [Math.max(a, reservado), b]])
      .filter(([a, b]) => b - a > 0.5);
    const inicio = ORDEN_DIRS.indexOf(entrada);
    const otras = [0, 1, 2, 3].map((i) => ORDEN_DIRS[(inicio + i) % 4]).filter((d) => d !== dirPreg);

    const obras = sala.obras ?? [];
    const cedulas = sala.cedulas ?? [];
    let reparto = null;
    for (const ancho of [3.4, 2.8, 2.2]) {
      const hp = huecos(intervalosPreg, ancho).map((h) => ({ ...h, p: pPreg }));
      const ho = otras.flatMap((d) => huecos(paredes[d].intervalos, ancho).map((h) => ({ ...h, p: paredes[d] })));
      if (hp.length + ho.length >= obras.length + cedulas.length || ancho === 2.2) {
        const paraCedulas = [...hp, ...ho.slice().reverse()];
        const usados = new Set();
        const cs = cedulas.map(() => paraCedulas.find((h) => !usados.has(h) && usados.add(h)));
        const os = obras.map(() => [...ho, ...hp].find((h) => !usados.has(h) && usados.add(h)));
        reparto = { cs, os };
        break;
      }
    }
    cedulas.forEach((ced, i) => {
      const h = reparto.cs[i];
      if (h) crearCedula(ced, sala, h.p, h.t);
      else console.warn(`No hay espacio para la cédula "${ced.titulo}" en ${sala.id}`);
    });
    obras.forEach((obra, i) => {
      const h = reparto.os[i];
      if (h) crearObra(obra, sala, h.p, h.t, Math.min(2.4, h.ancho - 0.7));
      else console.warn(`No hay espacio para la obra "${obra.titulo}" en ${sala.id}`);
    });

    // Filete de color en el suelo, al centro de la sala.
    const lado = 7.5;
    const ancho = 0.12;
    for (const [dx, dz, w, d] of [[0, -lado / 2, lado, ancho], [0, lado / 2, lado, ancho], [-lado / 2, 0, ancho, lado], [lado / 2, 0, ancho, lado]]) {
      acento(sala.color, fijar(new THREE.PlaneGeometry(w, d), c.x + dx, 0.004, c.z + dz, 0, -Math.PI / 2));
    }

    const destinoVista = pPreg.centro.clone();
    destinoVista.y = 2.2;
    const posicion = pPreg.centro.clone().addScaledVector(pPreg.normal, 7.5);
    posicion.y = ALTURA_OJOS;
    return { posicion, mirar: destinoVista };
  }

  function amueblarVestibulo(c) {
    const paredes = Object.fromEntries(ORDEN_DIRS.map((d) => [d, pared(c, d)]));
    const dirPuerta = ORDEN_DIRS.find((d) => c.puertas[d]);
    const pFrente = paredes[dirPuerta];
    for (const p of Object.values(paredes)) {
      zocalos(p, '#c9b89a');
      if (p.destino) letreroPuerta(c, p);
    }

    // Título y lema, a la izquierda de la puerta.
    const tc = lienzo(1500, 1000);
    const tctx = tc.getContext('2d');
    const alto = componer(tctx, [
      { texto: (museo.subtitulo ?? '').toUpperCase(), tam: 38, peso: 600, color: COLOR_TENUE, alinear: 'center', espacio: 30 },
      { texto: museo.titulo, tam: 130, familia: 'serif', color: COLOR_TINTA, alinear: 'center', interlineado: 1.08, espacio: 36 },
      { texto: museo.lema, tam: 66, familia: 'serif', italica: true, color: COLOR_CALIDO, alinear: 'center' },
    ], 40, 40, 1420, 800, { centrarVertical: true });
    const anchoFranja = 60;
    const x0 = 750 - (salas.length * anchoFranja) / 2;
    const yFranja = Math.min(960, 40 + (800 + alto) / 2 + 50);
    salas.forEach((s, i) => {
      tctx.fillStyle = s.color;
      tctx.fillRect(x0 + i * anchoFranja, yFranja, anchoFranja, 12);
    });
    colocar(planoTexto(tc, 5.2, { transparente: true }), pFrente, -4.9, 2.5);

    // Recorrido, a la derecha de la puerta.
    const rc = lienzo(1500, 1000);
    const rctx = rc.getContext('2d');
    rctx.fillStyle = '#fbfaf6';
    rctx.fillRect(0, 0, 1500, 1000);
    componer(rctx, [
      { texto: (ui.recorrido ?? '').toUpperCase(), tam: 44, peso: 700, color: COLOR_CALIDO, espacio: 34 },
      ...salas.map((s, i) => ({
        texto: `${s.etiqueta ?? s.id} · ${s.titulo}`, tam: 50, familia: 'serif', color: COLOR_TINTA,
        interlineado: 1.2, espacio: 26, sangria: 90, vineta: `${i + 1}`, colorVineta: s.color,
      })),
    ], 90, 80, 1320, 860);
    const recorrido = planoTexto(rc, 4.6, { brillo: 0.45 });
    marcarClicable(recorrido, {
      tipo: 'texto', titulo: ui.recorrido,
      lista: salas.map((s) => `${s.etiqueta ?? s.id} · ${s.titulo}`),
    });
    colocar(recorrido, pFrente, 4.9, 2.1);

    // Bienvenida y créditos, en la pared izquierda.
    const lateral = paredes[ORDEN_DIRS[(ORDEN_DIRS.indexOf(dirPuerta) + 3) % 4]];
    const bc = lienzo(1500, 1000);
    const bctx = bc.getContext('2d');
    bctx.fillStyle = '#fbfaf6';
    bctx.fillRect(0, 0, 1500, 1000);
    bctx.fillStyle = COLOR_CALIDO;
    bctx.fillRect(0, 0, 1500, 14);
    componer(bctx, [
      { texto: museo.titulo, tam: 70, familia: 'serif', color: COLOR_TINTA, espacio: 30 },
      { texto: museo.bienvenida, tam: 44, color: '#3b3732', interlineado: 1.45, espacio: 40 },
      { texto: museo.creditos, tam: 34, italica: true, color: COLOR_TENUE, interlineado: 1.4 },
    ], 100, 90, 1300, 820);
    const bienvenida = planoTexto(bc, 4.6, { brillo: 0.45 });
    marcarClicable(bienvenida, { tipo: 'texto', titulo: museo.titulo, texto: [museo.bienvenida, museo.creditos].filter(Boolean).join('\n') });
    colocar(bienvenida, lateral, 0, 2.1);

    // Luz cálida al centro.
    const lampara = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, ALTO - 3.9, 6), new THREE.MeshBasicMaterial({ color: 0x3a3631 }));
    cable.position.y = (ALTO + 3.9) / 2;
    const globo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
    globo.position.y = 3.7;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texturaResplandor('rgba(255,196,120,0.85)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    halo.scale.set(3.4, 3.4, 1);
    halo.position.y = 3.7;
    const charco = new THREE.Mesh(geomPlano, new THREE.MeshBasicMaterial({
      map: texturaResplandor('rgba(255,170,90,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    charco.rotation.x = -Math.PI / 2;
    charco.scale.set(6, 6, 1);
    charco.position.y = 0.01;
    const luz = new THREE.PointLight(0xffb469, 14, 13, 2);
    luz.position.y = 3.5;
    lampara.add(cable, globo, halo, charco, luz);
    lampara.position.set(c.x, 0, c.z);
    escena.add(lampara);

    const vista = pFrente.centro.clone();
    vista.y = 2.3;
    const posicion = pFrente.centro.clone().addScaledVector(pFrente.normal, 10.5);
    posicion.y = ALTURA_OJOS;
    return { posicion, mirar: vista };
  }

  // ---------- Suelos, techos y contenido ----------
  const puntos = [];
  for (const c of plano.celdas) {
    geoms.suelo.push(fijar(new THREE.PlaneGeometry(CELDA, CELDA), c.x, 0, c.z, 0, -Math.PI / 2));
    geoms.techo.push(fijar(new THREE.PlaneGeometry(CELDA, CELDA), c.x, ALTO, c.z, 0, Math.PI / 2));
    geoms.lucernario.push(fijar(new THREE.PlaneGeometry(7, 7), c.x, ALTO - 0.02, c.z, 0, Math.PI / 2));
    puntos[c.orden] = c.sala ? amueblarSala(c) : amueblarVestibulo(c);
  }

  const fusionar = (lista, material) => {
    const malla = new THREE.Mesh(mergeGeometries(lista), material);
    malla.matrixAutoUpdate = false;
    escena.add(malla);
    return malla;
  };
  const muros = fusionar(geoms.muros, mats.muro);
  fusionar(geoms.suelo, mats.suelo);
  fusionar(geoms.techo, mats.techo);
  fusionar(geoms.lucernario, mats.lucernario);
  for (const [color, lista] of geomsAcento) {
    fusionar(lista, new THREE.MeshLambertMaterial({ color, emissive: mezclar(color, '#000000', 0.7) }));
  }

  // Iluminación general: cenital difusa, sin sombras.
  escena.add(new THREE.HemisphereLight(0xffffff, 0xd9d6d0, 2.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.0);
  sol.position.set(0.4, 1, 0.25);
  escena.add(sol);

  return { colisionadores, clicables, muros, puntos };
}
