import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { cargarContenido } from './contenido.js';
import { construirMuseo, celdaDePosicion } from './mundo.js';
import { crearMinimapa } from './minimapa.js';
import { configurarAnisotropia } from './texturas.js';

const ALTURA_OJOS = 1.65;
const RADIO_VISITANTE = 0.35;
const VELOCIDAD = 3.0;
const VELOCIDAD_RAPIDA = 5.5;

const $ = (id) => document.getElementById(id);

// ── Render ──────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
$('escena').appendChild(renderer.domElement);
configurarAnisotropia(renderer);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1916);
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
camera.rotation.order = 'YXZ';
camera.position.set(0, ALTURA_OJOS, 0);

const controls = new PointerLockControls(camera, document.body);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Estado ──────────────────────────────────────────────────────────
let museo = null;
let ui = {};
let dibujarMapa = null;
let lugarActual = null;
let haEntrado = false;
let panelAbierto = false;
let apuntado = null;
const teclas = new Set();
const velocidad = new THREE.Vector3();

// ── Carga ───────────────────────────────────────────────────────────
cargarContenido()
  .then(iniciar)
  .catch((e) => {
    console.error(e);
    $('cargando').hidden = true;
    const err = $('inicio-error');
    err.hidden = false;
    err.textContent = 'No se pudo cargar contenido.json. Revisá que el archivo exista y sea un JSON válido.';
  });

function iniciar(contenido) {
  ui = contenido.interfaz ?? {};
  const m = contenido.museo ?? {};
  document.title = [m.titulo, m.lema].filter(Boolean).join(' · ') || document.title;

  $('inicio-subtitulo').textContent = m.subtitulo ?? '';
  $('inicio-titulo').textContent = m.titulo ?? '';
  $('inicio-lema').textContent = m.lema ?? '';
  $('inicio-instr-titulo').textContent = ui.instruccionesTitulo ?? '';
  const dl = $('inicio-instrucciones');
  for (const { tecla, accion } of ui.instrucciones ?? []) {
    const dt = document.createElement('dt');
    const kbd = document.createElement('kbd');
    kbd.textContent = tecla;
    dt.appendChild(kbd);
    const dd = document.createElement('dd');
    dd.textContent = accion;
    dl.append(dt, dd);
  }
  $('boton-entrar').textContent = ui.botonEntrar ?? '';
  $('panel-cerrar').textContent = ui.cerrar ?? '';
  $('mapa-estas').textContent = ui.mapaEstasEn ?? '';

  museo = construirMuseo(scene, contenido);
  dibujarMapa = crearMinimapa($('mapa-canvas'), museo.lugares);
  teletransportar(0);

  // Compila shaders y sube texturas antes de entrar, para evitar tirones.
  renderer.compile(scene, camera);
  renderer.render(scene, camera);

  $('cargando').hidden = true;
  $('inicio-contenido').hidden = false;
  $('boton-entrar').focus();
  renderer.setAnimationLoop(bucle);
  if (new URLSearchParams(location.search).has('debug')) {
    window.__museo = { camera, museo, abrirPanel, teclas, mover };
  }
}

// ── Pantalla de inicio / pausa ─────────────────────────────────────
$('boton-entrar').addEventListener('click', () => controls.lock());

controls.addEventListener('lock', () => {
  haEntrado = true;
  $('inicio').hidden = true;
  $('mira').hidden = false;
  if (!$('mapa').dataset.oculto) $('mapa').hidden = false;
});

controls.addEventListener('unlock', () => {
  teclas.clear();
  $('mira').hidden = true;
  $('pista').hidden = true;
  if (!panelAbierto) mostrarPausa();
});

document.addEventListener('pointerlockerror', () => {
  if (!panelAbierto) mostrarPausa();
});

function mostrarPausa() {
  $('boton-entrar').textContent = haEntrado ? (ui.botonContinuar ?? '') : (ui.botonEntrar ?? '');
  $('inicio').hidden = false;
  $('boton-entrar').focus();
}

// ── Teclado ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (panelAbierto) {
    if (e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      cerrarPanel(e.code === 'Enter');
    }
    return;
  }
  if (!museo) return;
  const digito = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digito) {
    const n = Number(digito[2]);
    if (n < museo.lugares.length) teletransportar(n);
    return;
  }
  if (e.code === 'KeyM' && haEntrado) {
    const mapa = $('mapa');
    mapa.hidden = !mapa.hidden;
    mapa.dataset.oculto = mapa.hidden ? '1' : '';
    return;
  }
  if (controls.isLocked) {
    teclas.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  }
});
document.addEventListener('keyup', (e) => teclas.delete(e.code));
window.addEventListener('blur', () => teclas.clear());

function teletransportar(indice) {
  const l = museo.lugares[indice];
  if (!l) return;
  camera.position.set(l.aparicion.x, ALTURA_OJOS, l.aparicion.z);
  camera.rotation.set(0, l.aparicion.yaw, 0, 'YXZ');
  velocidad.set(0, 0, 0);
}

// ── Movimiento y colisiones ────────────────────────────────────────
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

function yawCamara() {
  return _euler.setFromQuaternion(camera.quaternion, 'YXZ').y;
}

function mover(dt) {
  const adelante = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0)
    - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0);
  const derecha = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0)
    - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0);
  const rapido = teclas.has('ShiftLeft') || teclas.has('ShiftRight');

  const yaw = yawCamara();
  const objetivo = new THREE.Vector3(
    -Math.sin(yaw) * adelante + Math.cos(yaw) * derecha,
    0,
    -Math.cos(yaw) * adelante - Math.sin(yaw) * derecha,
  );
  if (objetivo.lengthSq() > 0) objetivo.normalize().multiplyScalar(rapido ? VELOCIDAD_RAPIDA : VELOCIDAD);
  velocidad.lerp(objetivo, 1 - Math.exp(-12 * dt));
  if (velocidad.lengthSq() < 1e-6) return;

  camera.position.addScaledVector(velocidad, dt);
  resolverColisiones(camera.position);
}

function resolverColisiones(p) {
  const R = RADIO_VISITANTE;
  for (let iter = 0; iter < 3; iter++) {
    for (const c of museo.colisionadores) {
      if (c.radio !== undefined) {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.radio + R;
        if (d < min && d > 1e-6) {
          p.x += (dx / d) * (min - d);
          p.z += (dz / d) * (min - d);
        }
        continue;
      }
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * (R - d);
        p.z += (dz / d) * (R - d);
      } else {
        // El centro quedó dentro de la caja: salir por el lado más cercano.
        const salidas = [
          [c.minX - R - p.x, 0], [c.maxX + R - p.x, 0],
          [0, c.minZ - R - p.z], [0, c.maxZ + R - p.z],
        ];
        salidas.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        p.x += salidas[0][0];
        p.z += salidas[0][1];
      }
    }
  }
}

// ── Interacción con cuadros, cédulas y preguntas ───────────────────
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
const CENTRO = new THREE.Vector2(0, 0);

function actualizarApuntado() {
  raycaster.setFromCamera(CENTRO, camera);
  const hits = raycaster.intersectObjects([...museo.interactivos, ...museo.ocluyentes], false);
  const hit = hits[0];
  const info = hit?.object.userData.interactivo;
  apuntado = info && hit.distance <= info.alcance ? info : null;
  $('mira').classList.toggle('activa', !!apuntado);
  const pista = $('pista');
  pista.hidden = !apuntado;
  if (apuntado) pista.textContent = ui.pistaClic ?? '';
}

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !controls.isLocked || !apuntado) return;
  abrirPanel(apuntado);
});

function abrirPanel(info) {
  panelAbierto = true;
  const l = info.lugar;
  const tarjeta = document.querySelector('.panel-tarjeta');
  tarjeta.style.setProperty('--acento', l.color);
  $('panel-sala').textContent = [l.numero, l.titulo].filter(Boolean).join(' · ');
  const texto = $('panel-texto');
  texto.replaceChildren();
  const figura = $('panel-figura');
  figura.hidden = true;

  const parrafos = (t) => String(t ?? '').split(/\n+/).filter(Boolean).forEach((linea) => {
    const p = document.createElement('p');
    p.textContent = linea;
    texto.appendChild(p);
  });

  if (info.tipo === 'obra') {
    $('panel-titulo').textContent = info.obra.titulo ?? '';
    figura.hidden = false;
    const img = $('panel-imagen');
    const pendiente = $('panel-pendiente');
    pendiente.textContent = ui.imagenPendiente ?? '';
    const sinImagen = () => { img.hidden = true; pendiente.hidden = false; };
    if (info.obra.imagen) {
      img.hidden = false;
      pendiente.hidden = true;
      img.onerror = sinImagen;
      img.alt = info.obra.titulo ?? '';
      img.src = info.obra.imagen;
    } else {
      img.removeAttribute('src');
      sinImagen();
    }
    parrafos(info.obra.nota);
  } else if (info.tipo === 'cedula') {
    $('panel-titulo').textContent = info.cedula.titulo ?? '';
    parrafos(info.cedula.texto);
  } else {
    $('panel-titulo').textContent = ui.preguntasTitulo ?? '';
    const ol = document.createElement('ol');
    for (const pregunta of l.datos.preguntas ?? []) {
      const li = document.createElement('li');
      li.textContent = pregunta;
      ol.appendChild(li);
    }
    texto.appendChild(ol);
  }

  controls.unlock();
  $('panel').hidden = false;
  $('panel-cerrar').focus();
}

function cerrarPanel(volverAlRecorrido = true) {
  $('panel').hidden = true;
  panelAbierto = false;
  if (volverAlRecorrido) controls.lock();
  else mostrarPausa();
}

$('panel-cerrar').addEventListener('click', () => cerrarPanel(true));
$('panel').addEventListener('mousedown', (e) => {
  if (e.target === $('panel')) cerrarPanel(true);
});

// ── Sala actual (mapa y aviso) ─────────────────────────────────────
let temporizadorAviso = 0;

function actualizarSala() {
  const { c, r } = celdaDePosicion(camera.position.x, camera.position.z);
  const l = museo.lugarEn.get(`${c}:${r}`);
  if (!l || l === lugarActual) return;
  lugarActual = l;
  const nombre = [l.numero, l.titulo].filter(Boolean).join(' · ');
  $('mapa-sala').textContent = nombre;
  if (!haEntrado) return;
  const aviso = $('aviso-sala');
  aviso.textContent = nombre;
  aviso.style.setProperty('--acento', l.color);
  aviso.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('visible'), 2600);
}

// ── Bucle principal ────────────────────────────────────────────────
const reloj = new THREE.Timer();
const mapa = $('mapa');

function bucle() {
  reloj.update();
  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.getElapsed();
  if (controls.isLocked) {
    mover(dt);
    actualizarApuntado();
  }
  for (const f of museo.actualizables) f(t);
  actualizarSala();
  if (!mapa.hidden) dibujarMapa(camera.position.x, camera.position.z, yawCamara(), lugarActual);
  renderer.render(scene, camera);
}
