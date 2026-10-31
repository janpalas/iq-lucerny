'use strict';

const LANTERN_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M12 5h8M16 2v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M10 8h12l-1.5 3h-9z" fill="currentColor"/>
  <rect x="11" y="11" width="10" height="13" rx="2" fill="var(--flame)" stroke="currentColor" stroke-width="2"/>
  <path d="M16 14c2 2.4 2 4.6 0 7c-2-2.4-2-4.6 0-7z" fill="var(--flame-core)"/>
  <path d="M10 24h12v3H10z" fill="currentColor"/>
</svg>`;

const GUARD_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="10" r="5" fill="currentColor"/>
  <path d="M10 7.5c1.5-3.5 10.5-3.5 12 0z" fill="var(--guard-hat)"/>
  <path d="M7 29c0-7 4-11 9-11s9 4 9 11z" fill="currentColor"/>
  <path d="M14 18l2 5 2-5" fill="var(--guard-hat)"/>
</svg>`;

const puzzles = window.PUZZLES;
const store = {
  get(k, d) { try { const v = localStorage.getItem('lucerny.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lucerny.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const el = id => document.getElementById(id);
const boardEl = el('board'), solutionEl = el('solution-board');
const raysToggle = el('rays-toggle');

let index = Math.min(Math.max(0, store.get('index', 0)), puzzles.length - 1);
let lanterns = new Set();   // keys "r,c"
let checked = false;

const key = (r, c) => r + ',' + c;

// Computes lighting for a set of lanterns: lit cells, horizontal/vertical beams,
// lit guards and lanterns that face each other.
function evaluate(grid, lanternSet) {
  const R = grid.length, C = grid[0].length;
  const lit = new Set(), hBeam = new Set(), vBeam = new Set(), litGuards = new Set(), facing = new Set();
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (const k of lanternSet) {
    const [r0, c0] = k.split(',').map(Number);
    lit.add(k);
    for (const [dr, dc] of dirs) {
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < R && c >= 0 && c < C && grid[r][c] !== '#') {
        const kk = key(r, c);
        lit.add(kk);
        (dr === 0 ? hBeam : vBeam).add(kk);
        if (grid[r][c] === 'G') litGuards.add(kk);
        if (lanternSet.has(kk)) { facing.add(k); facing.add(kk); }
        r += dr; c += dc;
      }
    }
  }
  const unlit = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (grid[r][c] === '.' && !lit.has(key(r, c))) unlit.push(key(r, c));
  }
  return { lit, hBeam, vBeam, litGuards, facing, unlit };
}

function renderBoard(target, grid, lanternSet, opts) {
  const { showRays, interactive, solutionSet, isSolution } = opts;
  const R = grid.length, C = grid[0].length;
  const ev = evaluate(grid, lanternSet);
  target.style.setProperty('--cols', C);
  target.style.setProperty('--rows', R);
  target.innerHTML = '';
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = key(r, c), ch = grid[r][c];
    const cell = document.createElement(interactive && ch === '.' ? 'button' : 'div');
    cell.className = 'cell';
    if (ch === '#') cell.classList.add('wall');
    else if (ch === 'G') { cell.classList.add('guard'); cell.innerHTML = GUARD_SVG; }
    if (showRays && ch !== '#') {
      if (ev.lit.has(k)) cell.classList.add('lit');
      if (ev.hBeam.has(k)) cell.classList.add('h-beam');
      if (ev.vBeam.has(k)) cell.classList.add('v-beam');
      if (ev.litGuards.has(k)) cell.classList.add('danger');
    }
    if (lanternSet.has(k)) {
      cell.classList.add('lantern');
      cell.insertAdjacentHTML('beforeend', `<span class="icon">${LANTERN_SVG}</span>`);
      if (showRays && ev.facing.has(k)) cell.classList.add('danger');
      if (solutionSet && !solutionSet.has(k)) cell.classList.add('wrong');
      if (isSolution) cell.classList.add('right');
    } else if (solutionSet && solutionSet.has(k)) {
      cell.classList.add('missing');
      cell.insertAdjacentHTML('beforeend', `<span class="icon ghost">${LANTERN_SVG}</span>`);
    }
    if (cell.tagName === 'BUTTON') {
      cell.type = 'button';
      cell.setAttribute('aria-label', `Řádek ${r + 1}, sloupec ${c + 1}${lanternSet.has(k) ? ', lucerna' : ''}`);
      cell.addEventListener('click', () => toggleLantern(k));
    }
    target.appendChild(cell);
  }
  return ev;
}

function puzzle() { return puzzles[index]; }
function solutionSet() { return new Set(puzzle().solution.map(([r, c]) => key(r, c))); }

function render() {
  const p = puzzle();
  const showRays = raysToggle.checked || checked;
  el('puzzle-info').textContent = `Úloha ${p.id} / ${puzzles.length} · ${p.difficulty} · ${p.grid.length}×${p.grid[0].length}`;
  el('puzzle-select').value = String(index);

  const wrong = checked && !isCorrect();
  renderBoard(boardEl, p.grid, lanterns, {
    showRays, interactive: !checked, solutionSet: wrong ? solutionSet() : null,
  });
  boardEl.classList.toggle('locked', checked);
  el('board-caption').textContent = wrong ? 'Tvoje řešení' : `Rozmístěno luceren: ${lanterns.size}`;

  el('solution-wrap').hidden = !wrong;
  if (wrong) renderBoard(solutionEl, p.grid, solutionSet(), { showRays: true, interactive: false, isSolution: true });

  el('done-btn').hidden = checked;
  el('clear-btn').hidden = checked;
  el('next-btn').hidden = !checked;
}

function isCorrect() {
  const sol = solutionSet();
  return lanterns.size === sol.size && [...lanterns].every(k => sol.has(k));
}

function toggleLantern(k) {
  if (checked) return;
  if (lanterns.has(k)) lanterns.delete(k); else lanterns.add(k);
  render();
}

function check() {
  checked = true;
  const p = puzzle();
  const result = el('result');
  result.hidden = false;
  if (isCorrect()) {
    result.className = 'result ok';
    result.innerHTML = `<strong>Správně!</strong> Celá síť je nasvícená pomocí ${lanterns.size} luceren.`;
  } else {
    const ev = evaluate(p.grid, lanterns);
    const reasons = [];
    if (lanterns.size === 0) reasons.push('Nebyla umístěna žádná lucerna.');
    else {
      if (ev.unlit.length) reasons.push(`Nenasvícená pole: ${ev.unlit.length}.`);
      if (ev.litGuards.size) reasons.push(`Osvětlení hlídači: ${ev.litGuards.size}.`);
      if (ev.facing.size) reasons.push(`Lucerny svítící proti sobě: ${ev.facing.size}.`);
      if (!reasons.length) reasons.push(`Rozmístění je platné, ale použilo ${lanterns.size} luceren – stačí ${p.solution.length}.`);
    }
    result.className = 'result bad';
    result.innerHTML = `<strong>Bohužel, to není správné řešení.</strong>
      <ul>${reasons.map(r => `<li>${r}</li>`).join('')}</ul>
      <p class="hint"><span class="mark wrong-mark"></span> lucerna navíc / na špatném místě
      &nbsp; <span class="mark missing-mark"></span> chybějící lucerna</p>`;
  }
  render();
  el('next-btn').focus();
}

function load(i) {
  index = (i + puzzles.length) % puzzles.length;
  store.set('index', index);
  lanterns = new Set();
  checked = false;
  el('result').hidden = true;
  render();
}

// Init
const select = el('puzzle-select');
puzzles.forEach((p, i) => {
  const o = document.createElement('option');
  o.value = String(i);
  o.textContent = `Úloha ${p.id} – ${p.difficulty}`;
  select.appendChild(o);
});
select.addEventListener('change', () => load(Number(select.value)));
raysToggle.checked = store.get('rays', true);
raysToggle.addEventListener('change', () => { store.set('rays', raysToggle.checked); render(); });
el('clear-btn').addEventListener('click', () => { lanterns.clear(); render(); });
el('done-btn').addEventListener('click', check);
el('next-btn').addEventListener('click', () => load(index + 1));
document.querySelector('.lg-lantern').innerHTML = LANTERN_SVG;
document.querySelector('.lg-guard').innerHTML = GUARD_SVG;
load(index);

// Přepínání typu úloh v záhlaví (Lucerny / Matice).
const MODES = { lucerny: 'Lucerny', matice: 'Matice' };
function setMode(mode) {
  if (!MODES[mode]) mode = 'lucerny';
  store.set('mode', mode);
  document.body.dataset.mode = mode;
  document.title = MODES[mode];
  for (const tab of document.querySelectorAll('.mode-tab')) tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  el('mode-lucerny').hidden = mode !== 'lucerny';
  el('mode-matice').hidden = mode !== 'matice';
  el('puzzle-select').hidden = mode !== 'lucerny';
  el('mx-select').hidden = mode !== 'matice';
}
for (const tab of document.querySelectorAll('.mode-tab')) tab.addEventListener('click', () => setMode(tab.dataset.mode));
setMode(store.get('mode', 'lucerny'));
