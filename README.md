# Museo-FH

Museo virtual 3D — **La religión y las religiones** · *Un mismo anhelo, muchos caminos*.
Formación Humana 3A.

Recorrido en primera persona por un vestíbulo y seis salas (Vite + three.js, sitio estático, sin backend).

## Usarlo

| Necesito… | Comando |
| --- | --- |
| Instalar (una vez) | `npm install` |
| Trabajar y ver cambios al instante | `npm run dev` |
| Generar el sitio final en `dist/` | `npm run build` |
| Probar el sitio final | `npm run preview` |

**Abrir sin internet ni servidor:** después de `npm run build`, abrí `dist/index.html` con doble clic.
El build genera `dist/contenido.js` (copia de `contenido.json` con las imágenes incrustadas) para que funcione como `file://`.
Si cambiás el contenido o las imágenes, volvé a ejecutar `npm run build`.

**GitHub Pages:** el workflow `.github/workflows/pages.yml` publica `dist/` en cada push a `main`.
Activalo una vez en *Settings → Pages → Source: GitHub Actions*.

## Controles

- **W A S D / flechas**: caminar · **Shift**: más rápido · **Mouse**: mirar
- **Clic** cerca de un cuadro, cédula o panel de preguntas: abre su texto
- **1–6**: ir directo a cada sala · **0**: vestíbulo · **M**: mapa · **Esc**: pausa

## Editar el contenido

Todo el texto sale de [`public/contenido.json`](public/contenido.json); no hay texto en el código.

```jsonc
{
  "museo":     { "titulo", "lema", "subtitulo" },
  "interfaz":  { "botonEntrar", "instrucciones": [{ "tecla", "accion" }], "imagenPendiente", ... },
  "vestibulo": { "titulo", "texto" },
  "salas": [                       // en orden: 1.1 … 1.5 y Sala final (máximo 6)
    {
      "id": "sala-1-1", "numero": "1.1", "titulo": "La religión", "color": "#C0392B",
      "obras":     [{ "titulo": "...", "nota": "...", "imagen": "imagenes/sala-1-1/obra-1.jpg" }],
      "cedulas":   [{ "titulo": "...", "texto": "..." }],
      "preguntas": ["...", "..."]
    }
  ]
}
```

- `imagen` vacío → el marco muestra "Imagen pendiente". Imágenes en `public/imagenes/` (máx. 1600 px).
- Las obras y cédulas se reparten solas por los muros (unas 8 obras por sala; si no entran, se avisa en la consola).
- `pendiente: true` marca lo que falta completar; el museo no lo usa, es solo una ayuda.
- En `nota` y `texto`, un salto de línea (`\n`) crea un párrafo nuevo.

## Plano

```
[1.2][1.3][1.4]
[1.1][ V ][1.5]      V = vestíbulo (luz cálida al centro)
     [Fin]           Recorrido: V → 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → V → Conclusiones
```

## Código

- `src/main.js` — render, controles, colisiones, panel, teletransporte
- `src/mundo.js` — plano, muros, puertas, luces y colgado de obras
- `src/texturas.js` — carteles y placas dibujados en canvas
- `src/minimapa.js` — mapa de la esquina
- `vite.config.js` — rutas relativas y soporte para abrir con doble clic
