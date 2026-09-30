'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// COLORS (paleta por tipo de pieza) la aporta la skin activa: ver "Skins".

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const B2B_MULTIPLIER = 1.5;
const MESSAGE_LIFE = 1500;
const FLASH_LIFE = 300;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, backToBack, lastMoveRotate, messages, flash;
let audioCtx = null;
let muted = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Regla de las 3 esquinas: una T cuenta como T-spin si su último movimiento
// fue una rotación y al menos 3 de las 4 esquinas de su caja 3x3 están ocupadas.
// Debe evaluarse antes de merge().
function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  let filled = 0;
  for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    const x = current.x + dx;
    const y = current.y + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function removeFullLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function clearLines(tSpin) {
  const cleared = removeFullLines();

  if (!cleared) {
    combo = 0;
    if (tSpin) {
      score += TSPIN_SCORES[0] * level;
      addMessage('T-SPIN', '#ba68c8');
      playSound('tspin');
    }
    updateHUD();
    return;
  }

  combo++;
  let base = tSpin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared];
  const difficult = tSpin || cleared === 4;
  const b2b = difficult && backToBack;
  if (b2b) base = Math.floor(base * B2B_MULTIPLIER);
  // Una limpieza "simple" (1-3 líneas sin T-spin) rompe la racha B2B
  backToBack = difficult;

  let gained = base * combo * level;
  const perfect = board.every(row => row.every(v => v === 0));
  if (perfect) gained += PERFECT_CLEAR_SCORES[cleared] * level;
  score += gained;

  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);

  if (tSpin) addMessage(`T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared]}`, '#ba68c8');
  else if (cleared === 4) addMessage('TETRIS', '#4dd0e1');
  if (b2b) addMessage('BACK-TO-BACK', '#ffd54f');
  if (combo >= 2) addMessage(`COMBO x${combo}`, '#81c784');
  if (perfect) addMessage('PERFECT CLEAR', '#ffffff');
  addMessage(`+${gained.toLocaleString()}`, '#7aa2f7');

  flash = { life: FLASH_LIFE, color: perfect ? '#ffffff' : (tSpin ? '#ba68c8' : '#ffd54f') };
  playSound(perfect ? 'perfect' : (difficult ? 'special' : 'clear'));
  if (combo >= 2) playSound('combo');
  updateHUD();
}

// ---- Efectos visuales ----
function addMessage(text, color) {
  messages.push({ text, color, life: MESSAGE_LIFE });
}

function updateEffects(dt) {
  for (const m of messages) m.life -= dt;
  messages = messages.filter(m => m.life > 0);
  if (flash) {
    flash.life -= dt;
    if (flash.life <= 0) flash = null;
  }
}

function drawEffects() {
  if (flash) {
    ctx.globalAlpha = 0.45 * (flash.life / FLASH_LIFE);
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "bold 22px 'Russo One', Impact, sans-serif";
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  messages.forEach((m, i) => {
    const t = 1 - m.life / MESSAGE_LIFE;
    ctx.globalAlpha = Math.min(1, m.life / 400);
    ctx.fillStyle = m.color;
    ctx.fillText(m.text, canvas.width / 2, canvas.height / 3 + i * 28 - t * 30);
  });
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

// ---- Efectos sonoros (Web Audio, sin archivos externos) ----
function playTone(freq, start, dur, type = 'square', vol = 0.06) {
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function playSound(kind) {
  if (muted) return;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  switch (kind) {
    case 'clear':
      playTone(440, 0, 0.12);
      playTone(554, 0.08, 0.14);
      break;
    case 'special':
      [523, 659, 784, 1047].forEach((f, i) => playTone(f, i * 0.07, 0.15));
      break;
    case 'tspin':
      playTone(330, 0, 0.1, 'sawtooth');
      playTone(494, 0.08, 0.16, 'sawtooth');
      break;
    case 'perfect':
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => playTone(f, i * 0.08, 0.2, 'triangle', 0.09));
      break;
    case 'combo':
      // el tono sube con cada combo encadenado
      playTone(400 * Math.pow(1.0595, Math.min(combo, 12) * 2), 0.15, 0.12, 'triangle', 0.08);
      break;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tSpin = isTSpin();
  merge();
  clearLines(tSpin);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 1 ? `x${combo}` : '-';
  b2bEl.textContent = backToBack ? 'ON' : '-';
}

// ==== Skins ====
// Cada skin define su paleta (`colors[1..7]`, alineada con los índices de PIECES),
// el fondo/borde de los canvas, el color de la rejilla y su propia función de
// dibujo de bloque: `drawBlock(ctx, px, py, color, size, alpha)` en píxeles.

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
  } else {
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#7986cb', '#ffb74d'],
    bg: '#1a1a25',
    grid: '#22222e',
    border: '#2a2a3a',
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x + 1, y + 1, size - 2, size - 2);
      // highlight
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(x + 1, y + 1, size - 2, 4);
    },
  },
  neon: {
    name: 'Neón',
    colors: [null, '#00f0ff', '#fff200', '#ff00ff', '#39ff14', '#ff073a', '#3d5afe', '#ff9100'],
    bg: '#000000',
    grid: '#0d0d16',
    border: '#3d2a6e',
    drawBlock(context, x, y, color, size, alpha) {
      const ghost = alpha < 1;
      context.shadowColor = color;
      context.shadowBlur = ghost ? 6 : 14;
      // relleno translúcido + contorno brillante
      context.globalAlpha = ghost ? alpha * 0.5 : 0.35;
      context.fillStyle = color;
      context.fillRect(x + 3, y + 3, size - 6, size - 6);
      context.globalAlpha = ghost ? Math.min(1, alpha * 3) : 1;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(x + 3, y + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      if (!ghost) {
        context.fillStyle = 'rgba(255,255,255,0.85)';
        context.fillRect(x + size / 2 - 2, y + size / 2 - 2, 4, 4);
      }
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [null, '#a0e7ef', '#fff3a6', '#d9c2f0', '#bfe8bf', '#f7b6b6', '#b9c3f2', '#ffd3a5'],
    bg: '#2b2838',
    grid: '#353146',
    border: '#4a4460',
    drawBlock(context, x, y, color, size, alpha) {
      context.globalAlpha = alpha < 1 ? Math.min(1, alpha * 1.5) : 1;
      context.fillStyle = color;
      roundRectPath(context, x + 2, y + 2, size - 4, size - 4, size * 0.28);
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
      if (alpha >= 1) {
        // brillo suave arriba a la izquierda
        context.fillStyle = 'rgba(255,255,255,0.55)';
        roundRectPath(context, x + size * 0.22, y + size * 0.18, size * 0.3, size * 0.14, size * 0.07);
        context.fill();
      }
    },
  },
  pixel: {
    name: 'Pixel art',
    colors: [null, '#3cbcfc', '#f8b800', '#b53dff', '#58d854', '#e40058', '#0058f8', '#f87858'],
    bg: '#101018',
    grid: '#1c1c2a',
    border: '#3a3a5a',
    drawBlock(context, x, y, color, size, alpha) {
      const p = Math.max(2, Math.floor(size / 10)); // tamaño de cada "píxel"
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(x, y, size, size);
      // biselado: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(x, y, size, p);
      context.fillRect(x, y, p, size);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(x, y + size - p, size, p);
      context.fillRect(x + size - p, y, p, size);
      // textura: tramado en damero en el interior
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 2; i < size / p - 2; i++)
        for (let j = 2; j < size / p - 2; j++)
          if ((i + j) % 2 === 0) context.fillRect(x + i * p, y + j * p, p, p);
      // destello
      context.fillStyle = 'rgba(255,255,255,0.8)';
      context.fillRect(x + p, y + p, p, p);
    },
  },
};

const SKIN_KEY = 'tetris.skin';
let skin = SKINS.retro;
let COLORS = skin.colors;

function isSkin(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SKINS, name);
}

function loadSkinName() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return isSkin(saved) ? saved : 'retro';
  } catch (e) {
    return 'retro';
  }
}

function applySkin(name, persist) {
  if (!isSkin(name)) name = 'retro';
  skin = SKINS[name];
  COLORS = skin.colors;
  const root = document.documentElement.style;
  root.setProperty('--board-bg', skin.bg);
  root.setProperty('--board-border', skin.border);
  if (persist) {
    try { localStorage.setItem(SKIN_KEY, name); } catch (e) { /* sin almacenamiento */ }
  }
  // Re-renderizar aunque el loop esté parado (pausa / game over)
  if (board && current) draw();
  if (next) drawNext();
}

const skinSelect = document.getElementById('skin-select');
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyX', 'KeyP', 'KeyM'];

function initSkins() {
  const name = loadSkinName();
  skinSelect.value = name;
  applySkin(name, false);
  skinSelect.addEventListener('change', () => {
    applySkin(skinSelect.value, true);
    skinSelect.blur(); // devolver el foco para que flechas/espacio sigan moviendo la pieza
  });
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save();
  skin.drawBlock(context, x * size, y * size, COLORS[colorIndex], size, alpha ?? 1);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = skin.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  updateEffects(dt);
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  backToBack = false;
  lastMoveRotate = false;
  messages = [];
  flash = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Si el selector de skin conserva el foco, las teclas de juego le quitan el foco
  // (sin cambiar su valor) y siguen controlando la partida.
  if (e.target === skinSelect && GAME_KEYS.includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  } else if (e.target instanceof Element && e.target.closest('select, input, textarea')) {
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initSkins();
init();
