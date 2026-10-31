// Generátor úloh „Matice“: z pevného semínka deterministicky sestaví sadu úloh, ve kterých
// se doplňuje chybějící obrázek v řadě nebo v mřížce 3×3. Obtížnost odpovídá zhruba
// 1. třídě ZŠ: opakující se vzory, počítání do pěti, zvětšování, otáčení o čtvrt otáčky,
// jednoduché mřížky. Každá úloha má 5 možností (A–E), z nichž právě jedna je správná.
//
// Obrázek (buňka) je pole prvků { k: 'shape', shape, fill, x, y, s, rot } – tvar se středem
// [x, y] a „poloměrem“ s v poli 100×100; fill je barva (red, blue, green, yellow, white).
(function (root) {
  'use strict';

  const SEED = 20261100; // zvoleno tak, aby správné odpovědi byly rovnoměrně mezi A–E
  const PER_DIFFICULTY = 12;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const int = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const other = (rng, arr, v) => pick(rng, arr.filter(x => x !== v));
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const sample = (rng, arr, k) => shuffle(rng, arr).slice(0, k);
  const range = n => Array.from({ length: n }, (_, i) => i);
  const mod = (a, n) => ((a % n) + n) % n;

  const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'cross'];
  const COLORS = ['red', 'blue', 'green', 'yellow'];
  const SHAPE_NAME = {
    circle: 'kruh', square: 'čtverec', triangle: 'trojúhelník', star: 'hvězda', diamond: 'kosočtverec', cross: 'kříž',
  };
  const COLOR_NAME = { red: 'červen', blue: 'modr', green: 'zelen', yellow: 'žlut' };
  const FEMININE = new Set(['star']);
  const itemName = ({ shape, color }) => `${COLOR_NAME[color]}${FEMININE.has(shape) ? 'á' : 'ý'} ${SHAPE_NAME[shape]}`;
  const shapeNames = shapes => shapes.map(s => SHAPE_NAME[s]).join(', ');

  const shp = (shape, fill, x, y, s, rot = 0) => ({ k: 'shape', shape, fill, x, y, s, rot: mod(rot, 360) });
  const fig = (shape, color, s = 32, rot = 0) => [shp(shape, color, 50, 50, s, rot)];
  const FRAME = shp('square', 'white', 50, 50, 37.5);
  const keyOf = cell => JSON.stringify(cell.map(it => JSON.stringify(it)).sort());

  // Rozmístění 1–5 stejných obrazců v poli.
  const SPOTS = {
    1: [[50, 50]],
    2: [[28, 50], [72, 50]],
    3: [[50, 27], [27, 72], [73, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [28, 72], [72, 72], [50, 50]],
  };
  const spotSize = n => n === 1 ? 26 : n === 2 ? 17 : 14;
  const group = (shape, color, n) => SPOTS[n] ? SPOTS[n].map(([x, y]) => shp(shape, color, x, y, spotSize(n))) : null;

  const CORNERS = [[20, 20], [80, 20], [80, 80], [20, 80]]; // po směru hodinových ručiček
  const SIZES = [14, 20, 26, 32, 38];
  const cells3x3 = f => range(9).map(i => f(Math.floor(i / 3), i % 3));
  const at = (f, i) => f(Math.floor(i / 3), i % 3);
  // Latinský čtverec 3×3 s náhodně proházenými řádky a sloupci.
  function latin(rng) {
    const rp = shuffle(rng, range(3)), cp = shuffle(rng, range(3));
    return [(r, c) => mod(rp[r] + cp[c], 3), (r, c) => mod(rp[r] - cp[c], 3)];
  }

  // Doplní k úloze 4 chybné možnosti vzniklé mutací parametrů správné odpovědi a možnosti zamíchá.
  function finish(rng, s) {
    const { cells, missing, make, ans, mutators } = s;
    if (cells.some(c => !c)) return null;
    const answer = cells[missing];
    const seen = new Set([keyOf(answer)]);
    const distractors = [];
    for (let t = 0; t < 500 && distractors.length < 4; t++) {
      let p = ans;
      const steps = rng() < 0.6 ? 1 : 2;
      for (let i = 0; i < steps; i++) p = pick(rng, mutators)(p, rng);
      const c = make(p);
      if (!c) continue;
      const k = keyOf(c);
      if (seen.has(k)) continue;
      seen.add(k);
      distractors.push(c);
    }
    if (distractors.length < 4) return null;
    const options = shuffle(rng, [answer, ...distractors]);
    return {
      layout: s.rows > 1 ? 'grid' : 'row', cols: s.cols, rows: s.rows,
      cells: cells.map((c, i) => i === missing ? null : c), missing,
      options, answer: options.indexOf(answer), rule: s.rule,
    };
  }

  // Řada, ve které se opakuje motiv (např. AB, ABC, AAB). Chybí obrázek až za prvním motivem.
  function motifRow(rng, motif, rule) {
    const n = Math.min(8, motif.length * 2 + 2);
    const make = p => fig(p.shape, p.color);
    const missing = int(rng, motif.length, n - 1);
    return finish(rng, {
      cols: n, rows: 1, cells: range(n).map(i => make(motif[i % motif.length])), missing, make,
      ans: motif[missing % motif.length],
      mutators: [
        (p, r) => pick(r, motif),
        (p, r) => ({ ...p, shape: other(r, SHAPES, p.shape) }),
        (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
      ],
      rule,
    });
  }

  const FAMILIES = {
    // ---- Lehké ----
    rowAB(rng) {
      const S = sample(rng, SHAPES, 2), C = sample(rng, COLORS, 2);
      const motif = S.map((shape, i) => ({ shape, color: C[i] }));
      return motifRow(rng, motif, `Pořád dokola se střídají dva obrázky: ${motif.map(itemName).join(' a ')}.`);
    },

    rowABC(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 3);
      const motif = S.map((shape, i) => ({ shape, color: C[i] }));
      return motifRow(rng, motif, `Pořád dokola se opakují tři obrázky: ${motif.map(itemName).join(', ')}.`);
    },

    rowColors(rng) {
      const shape = pick(rng, SHAPES), C = sample(rng, COLORS, pick(rng, [2, 3]));
      const motif = C.map(color => ({ shape, color }));
      return motifRow(rng, motif, `Tvar je pořád stejný a dokola se opakují barvy: ${motif.map(itemName).join(', ')}.`);
    },

    rowCount(rng) {
      const shape = pick(rng, SHAPES), color = pick(rng, COLORS), n = 5, dec = rng() < 0.3;
      const counts = range(n).map(i => dec ? n - i : i + 1);
      const make = p => group(p.shape, p.color, p.n);
      const missing = rng() < 0.5 ? n - 1 : int(rng, 1, n - 2);
      return finish(rng, {
        cols: n, rows: 1, cells: counts.map(c => make({ shape, color, n: c })), missing, make,
        ans: { shape, color, n: counts[missing] },
        mutators: [
          (p, r) => ({ ...p, n: p.n + pick(r, [-1, 1]) }),
          (p, r) => ({ ...p, shape: other(r, SHAPES, p.shape) }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: `V každém dalším políčku je o jeden obrázek ${dec ? 'méně' : 'víc'}.`,
      });
    },

    // ---- Střední ----
    rowAAB(rng) {
      const pattern = pick(rng, ['AAB', 'ABB', 'AABB']);
      const S = sample(rng, SHAPES, 2), C = sample(rng, COLORS, 2);
      const items = S.map((shape, i) => ({ shape, color: C[i] }));
      const motif = [...pattern].map(ch => items[ch === 'A' ? 0 : 1]);
      return motifRow(rng, motif, `Pořád dokola se opakuje skupina: ${motif.map(itemName).join(', ')}.`);
    },

    rowGrow(rng) {
      const shape = pick(rng, SHAPES), color = pick(rng, COLORS), dec = rng() < 0.4, n = 5;
      const sizes = dec ? SIZES.slice().reverse() : SIZES;
      const make = p => fig(p.shape, p.color, SIZES[p.i]);
      const idx = i => dec ? n - 1 - i : i;
      const missing = int(rng, 1, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: sizes.map((_, i) => make({ shape, color, i: idx(i) })), missing, make,
        ans: { shape, color, i: idx(missing) },
        mutators: [
          (p, r) => ({ ...p, i: other(r, range(SIZES.length), p.i) }),
          (p, r) => ({ ...p, shape: other(r, SHAPES, p.shape) }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: `Obrázek se postupně ${dec ? 'zmenšuje' : 'zvětšuje'}.`,
      });
    },

    rowRotate(rng) {
      const color = pick(rng, COLORS), start = int(rng, 0, 3) * 90, n = 6;
      const make = p => fig('arrow', p.color, 34, p.rot);
      const missing = int(rng, 2, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make({ color, rot: start + i * 90 })), missing, make,
        ans: { color, rot: start + missing * 90 },
        mutators: [
          (p, r) => ({ ...p, rot: p.rot + int(r, 1, 3) * 90 }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: 'Šipka se v každém kroku otočí o čtvrt otáčky doprava (po směru hodinových ručiček).',
      });
    },

    rowCorner(rng) {
      const color = pick(rng, COLORS), start = int(rng, 0, 3), n = 6;
      const make = p => [FRAME, shp('circle', p.color, ...CORNERS[mod(p.pos, 4)], 9)];
      const missing = int(rng, 2, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make({ color, pos: start + i })), missing, make,
        ans: { color, pos: start + missing },
        mutators: [
          (p, r) => ({ ...p, pos: p.pos + int(r, 1, 3) }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: 'Tečka přeskakuje do dalšího rohu čtverce po směru hodinových ručiček.',
      });
    },

    gridShapeColor(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 3), T = rng() < 0.5;
      const make = p => fig(p.shape, p.color);
      const params = (r, c) => T ? { shape: S[c], color: C[r] } : { shape: S[r], color: C[c] };
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: at(params, missing),
        mutators: [
          (p, r) => ({ ...p, shape: other(r, r() < 0.7 ? S : SHAPES, p.shape) }),
          (p, r) => ({ ...p, color: other(r, r() < 0.7 ? C : COLORS, p.color) }),
        ],
        rule: T
          ? 'V každém sloupci je stejný tvar a v každém řádku stejná barva.'
          : 'V každém řádku je stejný tvar a v každém sloupci stejná barva.',
      });
    },

    gridCount(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 3);
      const make = p => group(p.shape, p.color, p.n);
      const params = (r, c) => ({ shape: S[r], color: C[r], n: c + 1 });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: at(params, missing),
        mutators: [
          (p, r) => ({ ...p, n: p.n + pick(r, [-1, 1, 2]) }),
          (p, r) => ({ ...p, shape: other(r, S, p.shape) }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: 'Každý řádek má svůj obrázek. Zleva doprava je v políčku jeden, dva a tři obrázky.',
      });
    },

    // ---- Těžké ----
    gridLatinShape(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 3);
      const [L] = latin(rng);
      const make = p => fig(S[p.s], C[p.c]);
      const params = (r, c) => ({ s: L(r, c), c: L(r, c) });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: at(params, missing),
        mutators: [
          (p, r) => ({ ...p, s: mod(p.s + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, c: mod(p.c + int(r, 1, 2), 3) }),
        ],
        rule: `V každém řádku i v každém sloupci je každý obrázek (${shapeNames(S)}) právě jednou.`,
      });
    },

    gridLatin(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 3);
      const [L1, L2] = latin(rng);
      const make = p => fig(S[p.s], C[p.c]);
      const params = (r, c) => ({ s: L1(r, c), c: L2(r, c) });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: at(params, missing),
        mutators: [
          (p, r) => ({ ...p, s: mod(p.s + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, c: mod(p.c + int(r, 1, 2), 3) }),
        ],
        rule: 'V každém řádku i v každém sloupci je každý tvar právě jednou a každá barva také právě jednou.',
      });
    },

    rowShapeColor(rng) {
      const S = sample(rng, SHAPES, 3), C = sample(rng, COLORS, 2), n = 8;
      const make = p => fig(p.shape, p.color);
      const params = i => ({ shape: S[i % 3], color: C[i % 2] });
      const missing = int(rng, 3, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make(params(i))), missing, make,
        ans: params(missing),
        mutators: [
          (p, r) => ({ ...p, shape: other(r, S, p.shape) }),
          (p, r) => ({ ...p, color: other(r, C, p.color) }),
          (p, r) => ({ ...p, color: other(r, COLORS, p.color) }),
        ],
        rule: `Tvary se opakují po třech (${shapeNames(S)}) a barvy se k tomu samostatně střídají po dvou.`,
      });
    },

    gridRotate(rng) {
      const C = sample(rng, COLORS, 3), starts = range(3).map(() => int(rng, 0, 3) * 90);
      const make = p => fig('arrow', p.color, 34, p.rot);
      const params = (r, c) => ({ color: C[r], rot: starts[r] + c * 90 });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: at(params, missing),
        mutators: [
          (p, r) => ({ ...p, rot: p.rot + int(r, 1, 3) * 90 }),
          (p, r) => ({ ...p, color: other(r, C, p.color) }),
        ],
        rule: 'Každý řádek má svou barvu a šipka se v něm zleva doprava otáčí vždy o čtvrt otáčky doprava.',
      });
    },
  };

  const PLAN = [
    ['Lehká', ['rowAB', 'rowColors', 'rowCount', 'rowABC']],
    ['Střední', ['rowAAB', 'gridShapeColor', 'rowGrow', 'gridCount', 'rowRotate', 'rowCorner']],
    ['Těžká', ['gridLatinShape', 'rowShapeColor', 'gridRotate', 'gridLatin']],
  ];

  function generate(seed) {
    const rng = mulberry32(seed);
    const out = [];
    for (const [difficulty, families] of PLAN) {
      for (let i = 0; i < PER_DIFFICULTY; i++) {
        const family = families[i % families.length];
        let p = null;
        for (let t = 0; !p; t++) {
          if (t > 1000) throw new Error('Nelze vygenerovat úlohu ' + family);
          p = FAMILIES[family](rng);
        }
        out.push({ id: out.length + 1, difficulty, family, ...p });
      }
    }
    return out;
  }

  root.MATRIX_PUZZLES = generate(SEED);
  root.MATRIX_KEY = keyOf;
})(typeof window !== 'undefined' ? window : globalThis);
