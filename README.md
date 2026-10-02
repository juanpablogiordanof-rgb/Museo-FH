# Museo-FH

Museo virtual 3D — *La religión y las religiones* · «Un mismo anhelo, muchos caminos».
Formación Humana 3A.

Recorrido en primera persona hecho con [Vite](https://vite.dev) y [three.js](https://threejs.org).
Es un sitio estático: no necesita backend.

## Controles

| Tecla | Acción |
| --- | --- |
| W A S D / flechas | Caminar |
| Mouse | Mirar alrededor |
| Shift | Caminar más rápido |
| Clic | Abrir la cédula de la obra o del panel que estás mirando (acércate primero) |
| 1 – 6 | Ir directo a cada sala |
| 0 | Volver al vestíbulo |
| Esc | Pausar y liberar el mouse |

## Editar el contenido

**Todo el texto del museo está en [`public/contenido.json`](public/contenido.json).**
No hay que tocar código para cambiar textos, colores ni imágenes.

```jsonc
{
  "museo": { "titulo", "lema", "subtitulo", "bienvenida", "creditos" },
  "ui":    { ...textos de botones, instrucciones y avisos... },
  "salas": [
    {
      "id": "1.1",
      "etiqueta": "Sala 1.1",
      "titulo": "La religión",
      "color": "#C0563B",                 // color de acento de la sala
      "obras":    [{ "titulo": "...", "nota": "...", "imagen": "imagenes/sala-1-1/obra-1.jpg" }],
      "cedulas":  [{ "titulo": "...", "texto": "..." }],
      "preguntas": ["...", "..."]
    }
  ]
}
```

- **Obras**: se cuelgan como cuadros con marco. Al hacer clic se abre su cédula (título, nota e imagen).
  Si `imagen` está vacío o el archivo no existe, se muestra un marco con «Imagen pendiente».
- **Cédulas**: paneles de texto en la pared, junto al panel de preguntas.
- **Preguntas**: el panel grande de cada sala, bajo el título.
- Los saltos de línea (`\n`) en `nota`, `texto` y `bienvenida` crean párrafos.

### Imágenes

Copia las imágenes en `public/imagenes/` (JPG, PNG o WebP) y escribe la ruta relativa en `imagen`.
Usa **1600 px de lado como máximo**: el museo reduce las más grandes, pero pesan más al cargar.

## Desarrollo

Requiere Node.js 20.19 o superior.

```bash
npm install
npm run dev       # servidor local con recarga automática
npm run build     # genera el sitio en dist/
npm run preview   # sirve dist/ para revisarlo
```

## Abrir el museo localmente (sin internet)

Después de `npm run build`, la carpeta `dist/` es el museo completo. Se puede copiar a un pendrive y:

- **Doble clic en `dist/index.html`**. Funciona sin servidor: en ese caso el contenido se lee de
  `contenido-local.js`, una copia de `contenido.json` (con las imágenes incluidas) que se genera en cada build.
  Si cambias `contenido.json`, vuelve a ejecutar `npm run build`.
- O con un servidor local, por ejemplo `npm run preview` o `python -m http.server` dentro de `dist/`.

## Publicar en GitHub Pages

El flujo [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila y publica el sitio en cada push a `main`.
Solo hay que activarlo una vez: en GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Todas las rutas son relativas, así que funciona en `https://<usuario>.github.io/Museo-FH/`.

## Estructura

```
public/contenido.json      contenido del museo (único lugar con texto)
public/imagenes/           imágenes de las obras
src/main.js                escena, controles, colisiones, clics y teletransporte
src/museo/plano.js         distribución de vestíbulo y salas
src/museo/construir.js     muros, puertas, cuadros, cédulas, paneles y luces
src/museo/lienzos.js       texturas de texto generadas con <canvas>
src/minimapa.js            mapa de la esquina
src/ficha.js               panel con la cédula de cada obra
vite.config.js             build con rutas relativas y soporte para abrir con doble clic
```

### Rendimiento

Pensado para laptops escolares con gráficos integrados: geometría simple (muros, suelos y techos fusionados
en pocas mallas), materiales Lambert, sin sombras, una sola luz puntual (la del vestíbulo),
texturas de 1600 px como máximo y resolución de render limitada a 1,5×.
