import './style.css';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { cargarContenido } from './contenido.js';
import { crearPlano, ALTURA_OJOS } from './museo/plano.js';
import { construirMuseo } from './museo/construir.js';
import { configurarAnisotropia } from './museo/lienzos.js';
import { Minimapa } from './minimapa.js';
import { crearFicha } from './ficha.js';

const $ = (id) => document.getElementById(id);

const RADIO = 0.3; // radio del visitante para las colisiones
const VELOCIDAD = 3;
const VELOCIDAD_RAPIDA = 5.5;
const ALCANCE_CLIC = 4.5;

function mostrarError(e) {
  console.error(e);
  document.querySelector('.girador')?.remove();
  const el = $('cargando-error');
  el.textContent = `No se pudo cargar contenido.json — ${e.message}`;
  el.classList.remove('oculto');
}

function pantallaInicio(contenido) {
  const { museo, ui, salas } = contenido;
  document.title = museo.titulo ?? document.title;
  $('inicio-subtitulo').textContent = museo.subtitulo ?? '';
  $('inicio-titulo').textContent = museo.titulo ?? '';
  $('inicio-lema').textContent = museo.lema ?? '';
  $('inicio-franjas').replaceChildren(...salas.map((s) => {
    const span = document.createElement('span');
    span.style.background = s.color;
    return span;
  }));
  $('inicio-controles-titulo').textContent = ui.tituloControles ?? '';
  $('inicio-controles').replaceChildren(...(ui.controles ?? []).flatMap(({ tecla, accion }) => {
    const dt = document.createElement('dt');
    const kbd = document.createElement('kbd');
    kbd.textContent = tecla;
    dt.append(kbd);
    const dd = document.createElement('dd');
    dd.textContent = accion;
    return [dt, dd];
  }));
  $('inicio-boton').textContent = ui.botonEntrar ?? '';
}

async function iniciar() {
  let contenido;
  try {
    contenido = await cargarContenido();
  } catch (e) {
    mostrarError(e);
    return;
  }
  const { ui } = contenido;

  // ---------- Escena ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  $('escena').append(renderer.domElement);
  configurarAnisotropia(renderer.capabilities.getMaxAnisotropy());

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0xe9e6df);
  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 120);

  const plano = crearPlano(contenido.salas);
  const { colisionadores, clicables, muros, puntos } = construirMuseo({ escena, plano, contenido });
  const objetivosRayo = [muros, ...clicables];

  camara.position.copy(puntos[0].posicion);
  camara.lookAt(puntos[0].mirar);

  const minimapa = new Minimapa($('minimapa-lienzo'), $('minimapa-sala'), plano, ui);
  const ficha = crearFicha($('ficha'), ui);
  const controles = new PointerLockControls(camara, document.body);
  controles.pointerSpeed = 0.8;

  pantallaInicio(contenido);
  $('cargando').classList.add('oculto');
  $('inicio').classList.remove('oculto');

  // ---------- Estados: inicio, recorrido, pausa, ficha ----------
  let estado = 'inicio';
  const teclas = new Set();

  // Si el navegador no permite capturar el mouse (p. ej. dentro de un iframe),
  // se pasa a "modo arrastre": se mira arrastrando con el botón presionado.
  let modoArrastre = false;
  let yaBloqueado = false;
  const recorriendo = () => controles.isLocked || (modoArrastre && estado === 'recorrido');

  function activarArrastre() {
    modoArrastre = true;
    estado = 'recorrido';
    ficha.cerrar();
    $('inicio').classList.add('oculto');
    $('hud').classList.remove('oculto');
  }

  function falloBloqueo() {
    if (yaBloqueado) mostrarPausa();
    else activarArrastre();
  }

  function bloquear() {
    if (modoArrastre || !document.body.requestPointerLock) {
      activarArrastre();
      return;
    }
    try {
      const promesa = document.body.requestPointerLock();
      promesa?.catch?.(falloBloqueo);
    } catch {
      falloBloqueo();
    }
  }
  document.addEventListener('pointerlockerror', falloBloqueo);

  function mostrarPausa() {
    estado = 'pausa';
    teclas.clear();
    $('inicio-boton').textContent = ui.botonContinuar ?? ui.botonEntrar ?? '';
    $('inicio').classList.remove('oculto');
  }

  controles.addEventListener('lock', () => {
    yaBloqueado = true;
    estado = 'recorrido';
    ficha.cerrar();
    $('inicio').classList.add('oculto');
    $('hud').classList.remove('oculto');
  });
  controles.addEventListener('unlock', () => {
    teclas.clear();
    if (estado !== 'ficha') mostrarPausa();
  });

  $('inicio-boton').addEventListener('click', bloquear);

  function abrirFicha(datos) {
    estado = 'ficha';
    teclas.clear();
    ficha.abrir(datos);
    controles.unlock();
  }
  ficha.alCerrar(() => {
    ficha.cerrar();
    bloquear();
  });

  let apuntado = null;
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && controles.isLocked && apuntado) abrirFicha(apuntado);
  });

  // Modo arrastre: girar la vista arrastrando; un clic sin arrastrar abre la ficha.
  const lienzo = renderer.domElement;
  const giro = new THREE.Euler(0, 0, 0, 'YXZ');
  let arrastre = null;
  lienzo.addEventListener('pointerdown', (e) => {
    if (!modoArrastre || estado !== 'recorrido' || e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, recorrido: 0 };
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x;
    const dy = e.clientY - arrastre.y;
    arrastre.x = e.clientX;
    arrastre.y = e.clientY;
    arrastre.recorrido += Math.abs(dx) + Math.abs(dy);
    giro.setFromQuaternion(camara.quaternion);
    giro.y -= dx * 0.004;
    giro.x = Math.max(-1.45, Math.min(1.45, giro.x - dy * 0.004));
    camara.quaternion.setFromEuler(giro);
  });
  lienzo.addEventListener('pointerup', () => {
    if (arrastre && arrastre.recorrido < 6 && apuntado) abrirFicha(apuntado);
    arrastre = null;
  });

  // Teletransporte con fundido (teclas 1–9 para las salas, 0 para el vestíbulo).
  let enTransito = false;
  function teletransportar(orden) {
    const p = puntos[orden];
    if (!p || enTransito) return;
    enTransito = true;
    $('fundido').classList.add('activo');
    setTimeout(() => {
      camara.position.copy(p.posicion);
      camara.lookAt(p.mirar);
      velocidad.set(0, 0, 0);
      $('fundido').classList.remove('activo');
      enTransito = false;
    }, 190);
  }

  document.addEventListener('keydown', (e) => {
    if (estado === 'ficha') {
      if (e.code === 'Escape') {
        ficha.cerrar();
        mostrarPausa();
      }
      return;
    }
    if (estado === 'inicio') return;
    if (modoArrastre && e.code === 'Escape' && estado === 'recorrido') {
      mostrarPausa();
      return;
    }
    const n = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (n) {
      teletransportar(Number(n[1]));
      return;
    }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    teclas.add(e.code);
  });
  document.addEventListener('keyup', (e) => teclas.delete(e.code));
  window.addEventListener('blur', () => teclas.clear());

  // ---------- Movimiento con colisiones ----------
  const velocidad = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const adelante = new THREE.Vector3();
  const derecha = new THREE.Vector3();
  const tecla = (...codigos) => (codigos.some((c) => teclas.has(c)) ? 1 : 0);

  function choca(x, z) {
    for (const c of colisionadores) {
      if (x > c.minX - RADIO && x < c.maxX + RADIO && z > c.minZ - RADIO && z < c.maxZ + RADIO) return true;
    }
    return false;
  }

  function mover(dt) {
    camara.getWorldDirection(adelante);
    adelante.y = 0;
    adelante.normalize();
    derecha.crossVectors(adelante, camara.up).normalize();

    objetivo.set(0, 0, 0);
    if (recorriendo()) {
      const f = tecla('KeyW', 'ArrowUp') - tecla('KeyS', 'ArrowDown');
      const r = tecla('KeyD', 'ArrowRight') - tecla('KeyA', 'ArrowLeft');
      objetivo.addScaledVector(adelante, f).addScaledVector(derecha, r);
      if (objetivo.lengthSq() > 0) {
        objetivo.normalize().multiplyScalar(tecla('ShiftLeft', 'ShiftRight') ? VELOCIDAD_RAPIDA : VELOCIDAD);
      }
    }
    velocidad.lerp(objetivo, 1 - Math.exp(-12 * dt));

    const p = camara.position;
    const nx = p.x + velocidad.x * dt;
    if (!choca(nx, p.z)) p.x = nx;
    else velocidad.x = 0;
    const nz = p.z + velocidad.z * dt;
    if (!choca(p.x, nz)) p.z = nz;
    else velocidad.z = 0;
    p.y = ALTURA_OJOS;
  }

  // ---------- Objetos clicables ----------
  const rayo = new THREE.Raycaster();
  rayo.far = ALCANCE_CLIC;
  const centro = new THREE.Vector2(0, 0);
  const mira = $('mira');
  const pista = $('pista');

  function apuntar() {
    let nuevo = null;
    if (recorriendo()) {
      rayo.setFromCamera(centro, camara);
      const golpe = rayo.intersectObjects(objetivosRayo, false)[0];
      nuevo = golpe?.object.userData.ficha ?? null;
    }
    if (nuevo === apuntado) return;
    apuntado = nuevo;
    mira.classList.toggle('activa', Boolean(nuevo));
    mira.style.setProperty('--acento', nuevo?.sala?.color ?? '#a0612b');
    pista.textContent = nuevo ? (nuevo.tipo === 'obra' ? ui.pistaObra : ui.pistaPanel) ?? '' : '';
    pista.classList.toggle('oculto', !nuevo);
  }

  // ---------- Bucle ----------
  let anterior = performance.now();
  renderer.setAnimationLoop((ahora) => {
    const dt = Math.min(0.1, (ahora - anterior) / 1000);
    anterior = ahora;
    mover(dt);
    apuntar();
    minimapa.dibujar(camara.position, Math.atan2(adelante.x, -adelante.z), plano.celdaEn(camara.position.x, camara.position.z));
    renderer.render(escena, camara);
  });

  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (import.meta.env.DEV) window.__museo = { teletransportar, camara, abrirFicha, mostrarPausa };
}

iniciar();
