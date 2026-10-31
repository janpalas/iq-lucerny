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
  function figureSvg(cell, attrs = '') {
    const pat = 'mxp' + (++uid);
    return `<svg ${attrs} viewBox="0 0 100 100" aria-hidden="true" stroke="currentColor" stroke-linejoin="round">
      <defs><pattern id="${pat}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" class="f-white" stroke="none"/><line x1="0" y1="0" x2="0" y2="5" stroke-width="2"/>
      </pattern></defs>${cell.map(it => itemSvg(it, pat)).join('')}</svg>`;
  }

  // ---- Rozstříhané zadání ----
  // Celé zadání jako jeden obrázek v souřadnicích 100 jednotek na buňku.
  function boardGeometry(p) {
    const gap = p.layout === 'grid' ? 18 : 10, pad = 16;
    const span = n => pad * 2 + n * 100 + (n - 1) * gap;
    return { gap, pad, W: span(p.cols), H: span(p.rows) };
  }

  function boardContent(p) {
    const { gap, pad, W, H } = boardGeometry(p);
    let out = `<rect width="${W}" height="${H}" class="f-white"/>`;
    p.cells.forEach((cell, i) => {
      const x = pad + (i % p.cols) * (100 + gap), y = pad + Math.floor(i / p.cols) * (100 + gap);
      out += cell
        ? figureSvg(cell, `x="${x}" y="${y}" width="100" height="100"`)
        : `<rect x="${x + 4}" y="${y + 4}" width="92" height="92" rx="10" class="mx-q-box"/>` +
          `<text x="${x + 50}" y="${y + 52}" class="mx-q">?</text>`;
    });
    return out;
  }

  const area = ([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // Rozřeže obdélník W×H na n trojúhelníků: největší trojúhelník se opakovaně
  // dělí úsečkou z vrcholu na protější (nejdelší) stranu.
  function cut(W, H, n) {
    if (W > 2 * H) return zigzag(W, H, n);
    const tl = [0, 0], tr = [W, 0], br = [W, H], bl = [0, H];
    let tris = Math.random() < 0.5 ? [[tl, tr, br], [tl, br, bl]] : [[tl, tr, bl], [tr, br, bl]];
    while (tris.length < n) {
      tris.sort((a, b) => area(b) - area(a));
      const t = tris.shift();
      let k = 0, best = -1;
      for (let i = 0; i < 3; i++) {
        const len = dist(t[(i + 1) % 3], t[(i + 2) % 3]);
        if (len > best) { best = len; k = i; }
      }
      const a = t[(k + 1) % 3], b = t[(k + 2) % 3], f = 0.35 + Math.random() * 0.3;
      const m = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      tris.push([t[k], a, m], [t[k], m, b]);
    }
    return tris;
  }

  // Dlouhou řadu rozřeže cikcak mezi body na horní a dolní hraně, aby nevznikaly tenké nudle.
  function zigzag(W, H, n) {
    const edge = (count, y) => Array.from({ length: count }, (_, i) => {
      const step = W / (count - 1);
      const x = i === 0 || i === count - 1 ? i * step : i * step + (Math.random() - 0.5) * 0.5 * step;
      return [x, y];
    });
    const a = Math.ceil((n + 2) / 2), top = edge(a, 0), bottom = edge(n + 2 - a, H);
    const tris = [];
    let i = 0, j = 0;
    while (i < top.length - 1 || j < bottom.length - 1) {
      if (j === bottom.length - 1 || (i < top.length - 1 && top[i + 1][0] < bottom[j + 1][0])) {
        tris.push([top[i], top[i + 1], bottom[j]]); i++;
      } else {
        tris.push([top[i], bottom[j + 1], bottom[j]]); j++;
      }
    }
    return tris;
  }

  // Jsou dva konvexní mnohoúhelníky od sebe aspoň o `gap`? (věta o oddělující ose)
  function separated(P, Q, gap) {
    for (const poly of [P, Q]) {
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        const nx = y1 - y2, ny = x2 - x1, len = Math.hypot(nx, ny);
        const proj = pts => pts.map(([x, y]) => (x * nx + y * ny) / len);
        const a = proj(P), b = proj(Q);
        if (Math.max(...a) + gap <= Math.min(...b) || Math.max(...b) + gap <= Math.min(...a)) return true;
      }
    }
    return false;
  }

  // Náhodně rozmístí a pootočí trojúhelníky tak, aby se nepřekrývaly a celé ležely v ploše.
  function scatter(p) {
    const { W, H } = boardGeometry(p);
    const tris = cut(W, H, 5 + Math.floor(Math.random() * 5)).sort((a, b) => area(b) - area(a));
    const Wa = Math.max(W, H * 1.9);
    let Ha = Math.max(H * 1.3, 2.2 * W * H / Wa);
    const margin = 8, gap = 10;
    for (;;) {
      const pieces = [];
      for (const tri of tris) {
        const c = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
        let placed = null;
        for (let t = 0; t < 400 && !placed; t++) {
          const rot = Math.random() * 360, rad = rot * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
          const pos = [margin + Math.random() * (Wa - 2 * margin), margin + Math.random() * (Ha - 2 * margin)];
          const pts = tri.map(([x, y]) => [
            pos[0] + (x - c[0]) * cos - (y - c[1]) * sin,
            pos[1] + (x - c[0]) * sin + (y - c[1]) * cos,
          ]);
          const inside = pts.every(([x, y]) => x >= margin && x <= Wa - margin && y >= margin && y <= Ha - margin);
          if (inside && pieces.every(q => separated(q.pts, pts, gap))) placed = { tri, c, pos, rot, pts };
        }
        if (!placed) break;
        pieces.push(placed);
      }
      if (pieces.length === tris.length) return { Wa, Ha, pieces };
      Ha *= 1.1;
    }
  }

  function scatterSvg(p, sc) {
    const id = 'mxb' + (++uid);
    const pts = tri => tri.map(([x, y]) => r2(x) + ',' + r2(y)).join(' ');
    let defs = `<g id="${id}">${boardContent(p)}</g>`, body = '';
    sc.pieces.forEach((pc, i) => {
      defs += `<clipPath id="${id}c${i}"><polygon points="${pts(pc.tri)}"/></clipPath>`;
      body += `<g transform="translate(${r2(pc.pos[0])} ${r2(pc.pos[1])}) rotate(${r2(pc.rot)}) translate(${r2(-pc.c[0])} ${r2(-pc.c[1])})">` +
        `<use href="#${id}" clip-path="url(#${id}c${i})"/><polygon points="${pts(pc.tri)}" class="mx-piece-edge"/></g>`;
    });
    return `<svg viewBox="0 0 ${r2(sc.Wa)} ${r2(sc.Ha)}" class="mx-scatter-svg" role="img"
      aria-label="Zadání rozstříhané na ${sc.pieces.length} trojúhelníků"><defs>${defs}</defs>${body}</svg>`;
  }

  // ---- Stav a vykreslení ----
  const boardEl = el('mx-board'), optionsEl = el('mx-options'), resultEl = el('mx-result');
  let index = Math.min(Math.max(0, store.get('mx.index', 0)), puzzles.length - 1);
  let selected = null;
  let checked = false;
  let scattered = null; // rozmístění dílků pro aktuální úlohu
  const cutToggle = el('mx-cut-toggle'), timerToggle = el('mx-timer-toggle');

  const puzzle = () => puzzles[index];

  function renderBoard() {
    const p = puzzle();
    if (cutToggle.checked && !checked) {
      scattered = scattered || scatter(p);
      boardEl.className = 'mx-scatter';
      boardEl.style.maxWidth = Math.round(scattered.Wa) + 'px';
      boardEl.removeAttribute('aria-label');
      boardEl.innerHTML = scatterSvg(p, scattered);
      return;
    }
    boardEl.style.maxWidth = '';
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

  // ---- Časový limit ----
  const LIMIT = 60000;
  let remaining = LIMIT, lastTick = performance.now();
  const timerEl = el('mx-timer');

  function renderTimer() {
    timerEl.hidden = !timerToggle.checked;
    const sec = Math.max(0, Math.ceil(remaining / 1000));
    timerEl.textContent = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    timerEl.classList.toggle('low', sec <= 10 && !checked);
    timerEl.classList.toggle('paused', checked);
  }

  // Čas běží jen v režimu Matice a dokud úloha není vyhodnocená.
  function tick() {
    const now = performance.now();
    if (timerToggle.checked && !checked && document.body.dataset.mode === 'matice') {
      remaining -= now - lastTick;
      if (remaining <= 0) {
        load(index + 1);
        el('mx-note').hidden = false;
      }
    }
    lastTick = now;
    renderTimer();
  }

  function choose(i) {
    if (checked) return;
    selected = i;
    el('mx-note').hidden = true;
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
    scattered = null;
    remaining = LIMIT;
    resultEl.hidden = true;
    el('mx-note').hidden = true;
    render();
    renderTimer();
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
  cutToggle.checked = store.get('mx.cut', false);
  cutToggle.addEventListener('change', () => { store.set('mx.cut', cutToggle.checked); renderBoard(); });
  timerToggle.checked = store.get('mx.timer', false);
  timerToggle.addEventListener('change', () => {
    store.set('mx.timer', timerToggle.checked);
    remaining = LIMIT;
    renderTimer();
  });
  setInterval(tick, 200);
  el('mx-next').addEventListener('click', () => load(index + 1));
  document.addEventListener('keydown', e => {
    if (document.body.dataset.mode !== 'matice' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const i = LETTERS.indexOf(e.key.toUpperCase());
    if (i >= 0 && e.key.length === 1) choose(i);
  });
  load(index);
})();
