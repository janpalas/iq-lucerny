// Generátor úloh „Matice“: z pevného semínka deterministicky sestaví sadu úloh, ve kterých
// se doplňuje chybějící obrázek v řadě nebo v mřížce 3×3. Každá úloha má 5 možností (A–E),
// z nichž právě jedna odpovídá pravidlu.
//
// Obrázek (buňka) je pole prvků:
//   { k: 'shape', shape, fill, x, y, s, rot }  – tvar se středem [x, y] a „poloměrem“ s v poli 100×100
//   { k: 'line', id }                          – úsečka z tabulky SEGS (v matrix.js)
//   { k: 'guide' }                             – slabý pomocný rámeček
(function (root) {
  'use strict';

  const SEED = 20261031;
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
  const popcount = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };

  const BASIC = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'cross'];
  const FILLS = ['white', 'gray', 'black', 'striped'];
  const SHAPE_NAME = {
    circle: 'kruh', square: 'čtverec', triangle: 'trojúhelník', diamond: 'kosočtverec',
    pentagon: 'pětiúhelník', hexagon: 'šestiúhelník', star: 'hvězda', cross: 'kříž',
  };
  const names = shapes => shapes.map(s => SHAPE_NAME[s]).join(' → ');

  const shp = (shape, fill, x, y, s, rot = 0) => ({ k: 'shape', shape, fill, x, y, s, rot: mod(rot, 360) });
  const FRAME = shp('square', 'white', 50, 50, 37.5);
  const keyOf = cell => JSON.stringify(cell.map(it => JSON.stringify(it)).sort());

  // Rozmístění 1–9 stejných obrazců v poli.
  const G = [22, 50, 78];
  const GRID9 = [[0, 0], [2, 0], [0, 2], [2, 2], [1, 1], [1, 0], [1, 2], [0, 1], [2, 1]].map(([i, j]) => [G[i], G[j]]);
  const SPOTS = {
    1: [[50, 50]],
    2: [[28, 50], [72, 50]],
    3: [[50, 27], [27, 72], [73, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [28, 72], [72, 72], [50, 50]],
    6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
    7: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78], [50, 50]],
    8: GRID9.filter(([x, y]) => !(x === 50 && y === 50)),
    9: GRID9,
  };
  const spotSize = n => n === 1 ? 26 : n === 2 ? 17 : n <= 5 ? 14 : n <= 6 ? 11 : 9;
  const group = (shape, fill, n) => SPOTS[n].map(([x, y]) => shp(shape, fill, x, y, spotSize(n)));

  // Osm pozic po obvodu čtverce, po směru hodinových ručiček od levého horního rohu.
  const POS8 = [[20, 20], [50, 20], [80, 20], [80, 50], [80, 80], [50, 80], [20, 80], [20, 50]];
  const SEGS = ['t', 'b', 'l', 'r', 'd1', 'd2', 'v', 'h'];
  const lines = mask => [{ k: 'guide' }, ...SEGS.filter((_, i) => mask >> i & 1).map(id => ({ k: 'line', id }))];
  const randomMask = (rng, k) => sample(rng, range(8), k).reduce((m, i) => m | 1 << i, 0);

  const dir = step => step > 0 ? 'po směru hodinových ručiček' : 'proti směru hodinových ručiček';
  const posBy = n => ({ 1: 'o jednu pozici', 2: 'o dvě pozice', 3: 'o tři pozice' })[n];
  const byCount = n => n === 1 ? 'o jeden' : 'o dva';
  // Latinský čtverec 3×3 s náhodně proházenými řádky a sloupci.
  function latin(rng) {
    const rp = shuffle(rng, range(3)), cp = shuffle(rng, range(3));
    return [(r, c) => mod(rp[r] + cp[c], 3), (r, c) => mod(rp[r] - cp[c], 3)];
  }
  const cells3x3 = f => range(9).map(i => f(Math.floor(i / 3), i % 3));

  // Doplní k úloze 4 chybné možnosti vzniklé mutací parametrů správné odpovědi a možnosti zamíchá.
  function finish(rng, s) {
    const { cells, missing, make, ans, mutators } = s;
    if (cells.some(c => !c)) return null;
    const answer = cells[missing];
    const seen = new Set([keyOf(answer)]);
    const distractors = [];
    for (let t = 0; t < 500 && distractors.length < 4; t++) {
      let p = ans;
      const steps = rng() < 0.55 ? 1 : 2;
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

  const FAMILIES = {
    // ---- Lehké: řady s jedním měnícím se atributem ----
    rowRotate(rng) {
      const shape = pick(rng, ['arrow', 'half', 'clock']);
      const step = pick(rng, [45, 90, 135]) * (rng() < 0.5 ? 1 : -1);
      const fill = pick(rng, ['white', 'gray', 'black']);
      const start = int(rng, 0, 7) * 45, n = 6;
      const make = p => [shp(shape, fill, 50, 50, 34, p.rot)];
      const missing = rng() < 0.5 ? n - 1 : int(rng, 1, n - 2);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make({ rot: start + i * step })), missing, make,
        ans: { rot: start + missing * step },
        mutators: [(p, r) => ({ rot: p.rot + int(r, 1, 7) * 45 })],
        rule: `Obrazec se v každém kroku otočí o ${Math.abs(step)}° ${dir(step)}.`,
      });
    },

    rowCount(rng) {
      const shape = pick(rng, BASIC), fill = pick(rng, FILLS), n = 5;
      const d = pick(rng, [1, 1, 2]);
      const a = int(rng, 1, 9 - (n - 1) * d);
      const dec = rng() < 0.35;
      const counts = range(n).map(i => a + i * d);
      if (dec) counts.reverse();
      const make = p => p.n >= 1 && p.n <= 9 ? group(p.shape, p.fill, p.n) : null;
      const missing = rng() < 0.6 ? n - 1 : int(rng, 1, n - 2);
      return finish(rng, {
        cols: n, rows: 1, cells: counts.map(c => make({ shape, fill, n: c })), missing, make,
        ans: { shape, fill, n: counts[missing] },
        mutators: [
          (p, r) => ({ ...p, n: p.n + pick(r, [-2, -1, 1, 2]) }),
          (p, r) => ({ ...p, n: p.n + pick(r, [-1, 1]) }),
          (p, r) => ({ ...p, shape: other(r, BASIC, p.shape) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: `Počet obrazců se v každém kroku ${dec ? 'zmenší' : 'zvětší'} ${byCount(d)}.`,
      });
    },

    rowSides(rng) {
      const fill = pick(rng, FILLS), n = 6;
      const make = p => p.k >= 3 && p.k <= 9 ? [shp('poly' + p.k, p.fill, 50, 50, 34)] : null;
      const missing = int(rng, 1, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make({ k: 3 + i, fill })), missing, make,
        ans: { k: 3 + missing, fill },
        mutators: [
          (p, r) => ({ ...p, k: p.k + pick(r, [-2, -1, 1, 2]) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: 'Každý další mnohoúhelník má o jednu stranu víc než předchozí.',
      });
    },

    rowPeriod(rng) {
      const S = sample(rng, BASIC, 3), n = 7;
      const motif = S.map(shape => ({ shape, fill: pick(rng, FILLS) }));
      const make = p => [shp(p.shape, p.fill, 50, 50, 34)];
      const missing = int(rng, 1, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make(motif[i % 3])), missing, make,
        ans: motif[missing % 3],
        mutators: [
          (p, r) => pick(r, motif),
          (p, r) => ({ ...p, shape: other(r, BASIC, p.shape) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: `Obrazce se pravidelně opakují ve skupinách po třech: ${names(S)}.`,
      });
    },

    gridCount(rng) {
      const S = sample(rng, BASIC, 3), F = range(3).map(() => pick(rng, FILLS));
      const d = pick(rng, [1, 1, 2]), a = int(rng, 1, 3);
      const T = rng() < 0.5; // transponovaná varianta: tvar podle sloupce, počet roste shora dolů
      const make = p => p.n >= 1 && p.n <= 9 ? group(p.shape, p.fill, p.n) : null;
      const params = (r, c) => { const [ln, st] = T ? [c, r] : [r, c]; return { shape: S[ln], fill: F[ln], n: a + st * d }; };
      const missing = rng() < 0.5 ? 8 : int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, n: p.n + pick(r, [-2, -1, 1, 2]) }),
          (p, r) => ({ ...p, shape: other(r, r() < 0.6 ? S : BASIC, p.shape) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: T
          ? `Každý sloupec má vlastní tvar a výplň. Shora dolů počet obrazců roste ${byCount(d)}.`
          : `Každý řádek má vlastní tvar a výplň. Zleva doprava počet obrazců roste ${byCount(d)}.`,
      });
    },

    // ---- Střední: kombinace dvou pravidel ----
    rowPeriod2(rng) {
      const S = sample(rng, BASIC, 3), F = sample(rng, FILLS, 2), n = 8;
      const make = p => [shp(p.shape, p.fill, 50, 50, 34)];
      const params = i => ({ shape: S[i % 3], fill: F[i % 2] });
      const missing = int(rng, 2, n - 1);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make(params(i))), missing, make,
        ans: params(missing),
        mutators: [
          (p, r) => ({ ...p, shape: other(r, S, p.shape) }),
          (p, r) => ({ ...p, shape: other(r, BASIC, p.shape) }),
          (p, r) => ({ ...p, fill: other(r, F, p.fill) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: `Tvary se opakují po třech (${names(S)}) a nezávisle na nich se střídají dvě výplně.`,
      });
    },

    rowMove(rng) {
      const a = pick(rng, [1, 2, 3]), b = pick(rng, [1, 2]), n = 6;
      const a0 = int(rng, 0, 7), b0 = int(rng, 0, 7);
      const make = p => mod(p.a, 8) === mod(p.b, 8) ? null : [
        FRAME, shp('circle', 'black', ...POS8[mod(p.a, 8)], 8), shp('circle', 'white', ...POS8[mod(p.b, 8)], 8),
      ];
      const missing = rng() < 0.5 ? n - 1 : int(rng, 1, n - 2);
      return finish(rng, {
        cols: n, rows: 1, cells: range(n).map(i => make({ a: a0 + i * a, b: b0 - i * b })), missing, make,
        ans: { a: a0 + missing * a, b: b0 - missing * b },
        mutators: [
          (p, r) => ({ ...p, a: p.a + int(r, 1, 7) }),
          (p, r) => ({ ...p, b: p.b + int(r, 1, 7) }),
          p => ({ a: p.b, b: p.a }),
        ],
        rule: `Černá tečka se po obvodu čtverce posouvá ${posBy(a)} po směru hodinových ručiček, bílá ${posBy(b)} proti směru.`,
      });
    },

    gridLatin(rng) {
      const S = sample(rng, BASIC, 3), byFill = rng() < 0.5;
      const F = sample(rng, FILLS, 3), N = sample(rng, [1, 2, 3, 4], 3), fill = pick(rng, FILLS);
      const [L1, L2] = latin(rng);
      const make = p => byFill ? [shp(S[p.s], F[p.v], 50, 50, 30)] : group(S[p.s], fill, N[p.v]);
      const missing = int(rng, 0, 8);
      const params = (r, c) => ({ s: L1(r, c), v: L2(r, c) });
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, s: mod(p.s + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, v: mod(p.v + int(r, 1, 2), 3) }),
        ],
        rule: `V každém řádku i sloupci se každý tvar i každ${byFill ? 'á výplň' : 'ý počet obrazců'} vyskytuje právě jednou.`,
      });
    },

    gridRotate(rng) {
      const steps = [45, 90, 135, -45, -90, -135];
      const a = pick(rng, steps), b = other(rng, steps, a);
      const base = int(rng, 0, 7) * 45, F = sample(rng, FILLS, 3);
      const make = p => [shp('arrow', p.fill, 50, 50, 34, p.rot)];
      const params = (r, c) => ({ rot: base + r * a + c * b, fill: F[r] });
      const missing = rng() < 0.5 ? 8 : int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, rot: p.rot + int(r, 1, 7) * 45 }),
          (p, r) => ({ ...p, fill: other(r, F, p.fill) }),
        ],
        rule: `Zleva doprava se šipka otáčí o ${Math.abs(b)}° ${dir(b)}, shora dolů o ${Math.abs(a)}° ${dir(a)}. Každý řádek má vlastní výplň.`,
      });
    },

    gridOr: rng => gridLogic(rng, 'or'),

    // ---- Těžké ----
    gridXor: rng => gridLogic(rng, 'xor'),
    gridAnd: rng => gridLogic(rng, 'and'),

    gridLatin3(rng) {
      const S = sample(rng, BASIC, 3), F = sample(rng, FILLS, 3), N = sample(rng, [1, 2, 3, 4], 3);
      const [L1, L2] = latin(rng);
      const np = shuffle(rng, range(3));
      const make = p => group(S[p.s], F[p.f], N[p.n]);
      const params = (r, c) => ({ s: L1(r, c), f: L2(r, c), n: np[L1(r, c)] });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, s: mod(p.s + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, f: mod(p.f + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, n: mod(p.n + int(r, 1, 2), 3) }),
        ],
        rule: 'V každém řádku i sloupci se každý tvar, každá výplň i každý počet obrazců vyskytuje právě jednou.',
      });
    },

    gridOuterInner(rng) {
      const S1 = sample(rng, ['circle', 'square', 'diamond', 'hexagon', 'pentagon'], 3);
      const S2 = sample(rng, ['circle', 'square', 'triangle', 'star', 'cross'], 3);
      const [L1, L2] = latin(rng);
      const make = p => [shp(S1[p.o], 'white', 50, 50, 38), shp(S2[p.i], p.f, 50, 50, 13)];
      const params = (r, c) => ({ o: L1(r, c), i: L2(r, c), f: 'black' });
      const missing = int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, o: mod(p.o + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, i: mod(p.i + int(r, 1, 2), 3) }),
          (p, r) => ({ ...p, f: pick(r, ['gray', 'striped']) }),
        ],
        rule: 'Vnější i vnitřní tvar se v každém řádku i sloupci vyskytuje právě jednou.',
      });
    },

    gridSum(rng) {
      const sub = rng() < 0.4;
      const S = sample(rng, BASIC, 3), F = range(3).map(() => pick(rng, FILLS));
      const rows = range(3).map(() => {
        if (sub) { const c1 = int(rng, 3, 9), c2 = int(rng, 1, c1 - 1); return [c1, c2, c1 - c2]; }
        const c1 = int(rng, 1, 5), c2 = int(rng, 1, Math.min(5, 9 - c1)); return [c1, c2, c1 + c2];
      });
      // Aspoň dva řádky nesmí tvořit aritmetickou posloupnost, jinak by pravidlo nebylo jednoznačné.
      if (rows.filter(([a, b, c]) => c !== 2 * b - a).length < 2) return null;
      const make = p => p.n >= 1 && p.n <= 9 ? group(p.shape, p.fill, p.n) : null;
      const params = (r, c) => ({ shape: S[r], fill: F[r], n: rows[r][c] });
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing: 8, make,
        ans: params(2, 2),
        mutators: [
          (p, r) => ({ ...p, n: p.n + pick(r, [-2, -1, 1, 2]) }),
          (p, r) => ({ ...p, shape: other(r, S, p.shape) }),
          (p, r) => ({ ...p, fill: other(r, FILLS, p.fill) }),
        ],
        rule: `Počet obrazců ve třetím sloupci je ${sub ? 'rozdílem' : 'součtem'} počtů v prvních dvou sloupcích. Každý řádek má vlastní tvar a výplň.`,
      });
    },

    gridMove(rng) {
      const ac = pick(rng, [1, 2, 3]), ar = pick(rng, [1, 2, 3]), bc = pick(rng, [1, 2]), br = pick(rng, [1, 2, 3]);
      const a0 = int(rng, 0, 7), b0 = int(rng, 0, 7);
      const make = p => mod(p.a, 8) === mod(p.b, 8) ? null : [
        FRAME, shp('circle', 'black', ...POS8[mod(p.a, 8)], 8), shp('circle', 'white', ...POS8[mod(p.b, 8)], 8),
      ];
      const params = (r, c) => ({ a: a0 + r * ar + c * ac, b: b0 - r * br - c * bc });
      const missing = rng() < 0.5 ? 8 : int(rng, 0, 8);
      return finish(rng, {
        cols: 3, rows: 3, cells: cells3x3((r, c) => make(params(r, c))), missing, make,
        ans: params(Math.floor(missing / 3), missing % 3),
        mutators: [
          (p, r) => ({ ...p, a: p.a + int(r, 1, 7) }),
          (p, r) => ({ ...p, b: p.b + int(r, 1, 7) }),
          p => ({ a: p.b, b: p.a }),
        ],
        rule: `Černá tečka se po obvodu posouvá po směru hodinových ručiček – zleva doprava ${posBy(ac)}, shora dolů ${posBy(ar)}. ` +
          `Bílá tečka se posouvá proti směru – zleva doprava ${posBy(bc)}, shora dolů ${posBy(br)}.`,
      });
    },
  };

  // Třetí obrázek v řádku vzniká z prvních dvou logickou operací nad čarami.
  function gridLogic(rng, op) {
    const fn = { or: (a, b) => a | b, xor: (a, b) => a ^ b, and: (a, b) => a & b }[op];
    const [lo, hi] = op === 'and' ? [3, 5] : [2, 4];
    const rows = [];
    for (let t = 0; rows.length < 3 && t < 200; t++) {
      const A = randomMask(rng, int(rng, lo, hi)), B = randomMask(rng, int(rng, lo, hi)), C = fn(A, B);
      if (A === B || C === A || C === B || popcount(C) < (op === 'and' ? 1 : 2)) continue;
      rows.push([A, B, C]);
    }
    if (rows.length < 3 || rows.filter(([A, B]) => A & B).length < 2) return null;
    const [A2, B2] = rows[2];
    const make = p => p.m ? lines(p.m) : null;
    const rule = {
      or: 'Třetí obrázek v každém řádku vznikne sloučením čar z prvních dvou obrázků.',
      xor: 'Třetí obrázek vznikne překrytím prvních dvou – čáry, které jsou v obou obrázcích, se navzájem vyruší.',
      and: 'Třetí obrázek obsahuje jen ty čáry, které jsou společné prvním dvěma obrázkům.',
    }[op];
    return finish(rng, {
      cols: 3, rows: 3, cells: rows.flat().map(m => make({ m })), missing: 8, make,
      ans: { m: rows[2][2] },
      mutators: [
        (p, r) => ({ m: p.m ^ 1 << int(r, 0, 7) }),
        (p, r) => ({ m: pick(r, [A2 | B2, A2 ^ B2, A2 & B2, A2, B2]) }),
      ],
      rule,
    });
  }

  const PLAN = [
    ['Lehká', ['rowRotate', 'rowCount', 'rowSides', 'rowPeriod', 'gridCount']],
    ['Střední', ['rowPeriod2', 'gridLatin', 'rowMove', 'gridOr', 'gridRotate', 'gridLatin']],
    ['Těžká', ['gridLatin3', 'gridXor', 'gridOuterInner', 'gridSum', 'gridMove', 'gridAnd']],
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
