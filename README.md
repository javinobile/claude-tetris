# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Reportar issues](#reportar-issues)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Menú de pausa** (`P` o `Escape`): Reanudar, Reiniciar, Ver controles y selector de **Nivel inicial** (1–10) para la próxima partida, guardado en `localStorage`. Se navega con el teclado y, mientras está abierto, las teclas del juego quedan bloqueadas para evitar movimientos accidentales al volver.
- **Game Over** con opción de reinicio.
- **Temas visuales (skins)**: selector **TEMA** en el panel lateral con cuatro estilos — **Retro** (bloques cuadrados y colores planos), **Neón** (fondo negro con efecto _glow_), **Pastel** (colores suaves y bordes redondeados) y **Pixel art** (textura pixelada en cada bloque). El cambio es instantáneo, incluso en pausa, y la elección se guarda en `localStorage`.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Abrir / cerrar el menú de pausa   |
| `Escape`  | Abrir / cerrar el menú de pausa   |

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay (`#overlay`) para **GAME OVER**.
- Un menú de pausa (`#pause-menu`) con Reanudar, Reiniciar, Ver controles y el selector de nivel inicial.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel es `max(nivelInicial, floor(líneas / 10) + 1)`, así que sube cada 10 líneas a partir del nivel inicial elegido; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Menú de pausa**: `P`/`Escape` detienen el bucle y muestran `#pause-menu`. Mientras está abierto, las flechas solo navegan por el menú. Al reanudar se ignoran las teclas durante un instante y el _auto-repeat_ de teclas mantenidas hasta una pulsación nueva. El nivel inicial se guarda en `localStorage` (`tetris.startLevel`) y lo aplica `init()`.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / menú de pausa (P, Esc)
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `SKINS`        | Temas visuales (paleta, fondo, rejilla y dibujo de bloque) | `retro`, `neon`, `pastel`, `pixel` |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

### Temas visuales (skins)

Cada entrada de `SKINS` define:

- `name`: nombre que se muestra.
- `colors`: array de 8 posiciones (`null` + un color por pieza, en el mismo orden que `PIECES`: I, O, T, S, Z, J, L).
- `bg`, `border` y `grid`: fondo y borde de los canvas (se aplican con las variables CSS `--board-bg` / `--board-border`) y color de la rejilla.
- `drawBlock(ctx, x, y, color, size, alpha)`: dibuja un bloque en coordenadas de píxel; `alpha < 1` indica la pieza fantasma.

Para añadir un tema nuevo, agrega una entrada a `SKINS` y una `<option>` con la misma clave en el `<select id="skin-select">` de `index.html`. La preferencia se guarda en `localStorage` bajo la clave `tetris.skin`; si el valor guardado no existe, se usa `retro`.

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Reportar issues

Las issues se crean **solo** con las plantillas (🐛 bug o ✨ mejora); así todas llegan con la misma estructura.

Al abrirse, el workflow **Claude Issue Triage** (`.github/workflows/claude-issue-triage.yml`):

1. Asigna labels de `type:`, `priority:`, `area:` y `status:` (definidos en `.github/labels.json`).
2. Busca posibles duplicados.
3. Publica un comentario con un diagnóstico preliminar (hipótesis con `archivo:línea`, nivel de confianza y próximos pasos) y un bloque JSON con los mismos datos.

Si faltan datos, la issue queda en `status: needs-info`; cuando el autor responde con un comentario, se vuelve a hacer el triage. El triage es una **sugerencia**: un mantenedor la revisa y gestiona `status: in-progress` / `status: blocked` a mano.

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
