'use strict';

// Úlohy „Matice“ – vykreslení obrázků a ovládání. Využívá `store` a `el` z app.js.
(() => {
  const puzzles = window.MATRIX_PUZZLES;
  const LETTERS = 'ABCDE';

  // ---- Geometrie tvarů (jednotkové souřadnice, střed v 0,0) ----
  function recenter(pts) {
    const ys = pts.map(p => p[1]), dy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return pts.map(([x, y]) => [x, y - dy]);
  }
  // Pravidelný k-úhelník s vodorovnou spodní hranou.
  const poly = k => recenter(Array.from({ length: k }, (_, i) => {
    const a = Math.PI / 2 + Math.PI / k + 2 * Math.PI * i / k;
    return [Math.cos(a), Math.sin(a)];
  }));
  const UNIT = {
    square: [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]],
    diamond: [[0, -1], [0.78, 0], [0, 1], [-0.78, 0]],
    triangle: poly(3), pentagon: poly(5), hexagon: poly(6),
    star: recenter(Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1;
      return [r * Math.cos(a), r * Math.sin(a)];
    })),
    cross: [[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1],
      [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]],
    arrow: [[0, -1], [0.62, -0.15], [0.24, -0.15], [0.24, 1], [-0.24, 1], [-0.24, -0.15], [-0.62, -0.15]],
  };
  for (let k = 3; k <= 9; k++) UNIT['poly' + k] = poly(k);

  const SEGS = {
    t: [14, 14, 86, 14], b: [14, 86, 86, 86], l: [14, 14, 14, 86], r: [86, 14, 86, 86],
    d1: [14, 14, 86, 86], d2: [86, 14, 14, 86], v: [50, 14, 50, 86], h: [14, 50, 86, 50],
  };

  const r2 = n => Math.round(n * 100) / 100;
  const fillAttr = (fill, pat) => fill === 'striped' ? `fill="url(#${pat})"` : `class="f-${fill}"`;

  function itemSvg(it, pat) {
    if (it.k === 'guide') return '<rect x="14" y="14" width="72" height="72" class="mx-guide"/>';
    if (it.k === 'line') {
      const [x1, y1, x2, y2] = SEGS[it.id];
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="mx-line"/>`;
    }
    const { shape, s } = it, f = fillAttr(it.fill, pat), sw = s < 14 ? 2.2 : 3;
    let body;
    if (shape === 'circle') body = `<circle r="${s}" ${f}/>`;
    else if (shape === 'half') body = `<circle r="${s}" class="f-white"/><path d="M${-s} 0A${s} ${s} 0 0 1 ${s} 0Z" class="f-black"/>`;
    else if (shape === 'clock') {
      body = `<circle r="${s}" ${f}/><line x1="0" y1="0" x2="0" y2="${r2(-s * 0.8)}" stroke-width="${sw * 1.5}" stroke-linecap="round"/>` +
        `<circle r="${sw * 1.2}" class="f-black"/>`;
    } else body = `<polygon points="${UNIT[shape].map(([x, y]) => r2(x * s) + ',' + r2(y * s)).join(' ')}" ${f}/>`;
    return `<g transform="translate(${it.x} ${it.y})${it.rot ? ` rotate(${it.rot})` : ''}" stroke-width="${sw}">${body}</g>`;
  }

  let uid = 0;
  function figureSvg(cell) {
    const pat = 'mxp' + (++uid);
    return `<svg viewBox="0 0 100 100" aria-hidden="true" stroke="currentColor" stroke-linejoin="round">
      <defs><pattern id="${pat}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="f-white" stroke="none"/><line x1="0" y1="0" x2="0" y2="5" stroke-width="2"/>
      </pattern></defs>${cell.map(it => itemSvg(it, pat)).join('')}</svg>`;
  }

  // ---- Stav a vykreslení ----
  const boardEl = el('mx-board'), optionsEl = el('mx-options'), resultEl = el('mx-result');
  let index = Math.min(Math.max(0, store.get('mx.index', 0)), puzzles.length - 1);
  let selected = null;
  let checked = false;

  const puzzle = () => puzzles[index];

  function renderBoard() {
    const p = puzzle();
    boardEl.style.setProperty('--cols', p.cols);
    boardEl.className = 'mx-board ' + p.layout;
    boardEl.setAttribute('aria-label', p.layout === 'grid' ? 'Mřížka 3×3 s jedním chybějícím obrázkem' : `Řada ${p.cols} obrázků s jedním chybějícím`);
    boardEl.innerHTML = '';
    p.cells.forEach(cell => {
      const d = document.createElement('div');
      d.className = 'mx-cell';
      if (cell) d.innerHTML = figureSvg(cell);
      else if (checked) { d.classList.add('mx-missing', 'solved'); d.innerHTML = figureSvg(p.options[p.answer]); }
      else { d.classList.add('mx-missing'); d.innerHTML = '<span>?</span>'; }
      boardEl.appendChild(d);
    });
  }

  function renderOptions() {
    const p = puzzle();
    optionsEl.innerHTML = '';
    p.options.forEach((cell, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mx-opt';
      b.setAttribute('aria-label', `Možnost ${LETTERS[i]}`);
      b.setAttribute('aria-pressed', String(selected === i));
      b.innerHTML = `<span class="mx-letter">${LETTERS[i]}</span>${figureSvg(cell)}`;
      if (checked) {
        b.setAttribute('aria-disabled', 'true');
        if (i === p.answer) b.classList.add('right');
        else if (i === selected) b.classList.add('wrong');
      }
      b.addEventListener('click', () => choose(i));
      optionsEl.appendChild(b);
    });
  }

  function render() {
    const p = puzzle();
    el('mx-info').textContent = `Úloha ${p.id} / ${puzzles.length} · ${p.difficulty} · ${p.layout === 'grid' ? 'mřížka 3×3' : 'řada'}`;
    el('mx-select').value = String(index);
    renderBoard();
    renderOptions();
    el('mx-done').hidden = checked;
    el('mx-done').disabled = selected === null;
    el('mx-next').hidden = !checked;
  }

  function choose(i) {
    if (checked) return;
    selected = i;
    render();
  }

  function check() {
    if (selected === null || checked) return;
    checked = true;
    const p = puzzle();
    resultEl.hidden = false;
    if (selected === p.answer) {
      resultEl.className = 'result ok';
      resultEl.innerHTML = `<strong>Správně!</strong><p class="mx-rule">${p.rule}</p>`;
    } else {
      resultEl.className = 'result bad';
      resultEl.innerHTML = `<strong>Bohužel, správná odpověď je ${LETTERS[p.answer]}.</strong><p class="mx-rule">${p.rule}</p>`;
    }
    render();
    el('mx-next').focus();
  }

  function load(i) {
    index = (i + puzzles.length) % puzzles.length;
    store.set('mx.index', index);
    selected = null;
    checked = false;
    resultEl.hidden = true;
    render();
  }

  // ---- Init ----
  const select = el('mx-select');
  puzzles.forEach((p, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Úloha ${p.id} – ${p.difficulty}`;
    select.appendChild(o);
  });
  select.addEventListener('change', () => load(Number(select.value)));
  el('mx-done').addEventListener('click', check);
  el('mx-next').addEventListener('click', () => load(index + 1));
  document.addEventListener('keydown', e => {
    if (document.body.dataset.mode !== 'matice' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const i = LETTERS.indexOf(e.key.toUpperCase());
    if (i >= 0 && e.key.length === 1) choose(i);
  });
  load(index);
})();
