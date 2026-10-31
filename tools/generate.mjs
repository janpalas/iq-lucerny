// Generates puzzles.js – run: node tools/generate.mjs [seed]
// Every puzzle has exactly one solution with the minimum number of lanterns.
import { writeFileSync } from 'node:fs';
import { solve } from './solver.mjs';

let seed = Number(process.argv[2] ?? 20261031);
function rand() { // mulberry32
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));

function randomGrid(R, C, wallDensity, guards) {
  const g = Array.from({ length: R }, () => Array(C).fill('.'));
  // walls placed with 180° rotational symmetry for a nicer look
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const r2 = R - 1 - r, c2 = C - 1 - c;
    if (r * C + c > r2 * C + c2) continue;
    if (rand() < wallDensity) { g[r][c] = '#'; g[r2][c2] = '#'; }
  }
  // occasionally grow a wall into a bigger block
  for (let k = 0; k < 2; k++) if (rand() < 0.4) {
    const r = randInt(0, R - 2), c = randInt(0, C - 2);
    g[r][c] = g[r][c + 1] = '#';
    if (rand() < 0.5) g[r + 1][c] = g[r + 1][c + 1] = '#';
  }
  let placed = 0, tries = 0;
  while (placed < guards && tries++ < 100) {
    const r = randInt(0, R - 1), c = randInt(0, C - 1);
    if (g[r][c] === '.') { g[r][c] = 'G'; placed++; }
  }
  return g.map(row => row.join(''));
}

const TIERS = [
  { name: 'Lehká', count: 10, sizes: [[5, 5], [5, 6]], walls: [0.12, 0.22], guards: [0, 1], nodes: [0, 60] },
  { name: 'Střední', count: 10, sizes: [[5, 7], [6, 6], [6, 7], [5, 8]], walls: [0.12, 0.2], guards: [1, 2], nodes: [40, 400] },
  { name: 'Těžká', count: 10, sizes: [[6, 8], [6, 9], [6, 10]], walls: [0.1, 0.18], guards: [1, 3], nodes: [250, Infinity] },
];

const seen = new Set();
const puzzles = [];
for (const tier of TIERS) {
  const pool = [];
  let attempts = 0;
  while (pool.length < tier.count * 6 && attempts++ < 400000) {
    const [R, C] = tier.sizes[randInt(0, tier.sizes.length - 1)];
    const grid = randomGrid(R, C, tier.walls[0] + rand() * (tier.walls[1] - tier.walls[0]), randInt(...tier.guards));
    const key = grid.join('/');
    if (seen.has(key)) continue;
    const wallCount = grid.join('').split('#').length - 1;
    if (wallCount > R * C * 0.3) continue;
    const res = solve(grid);
    if (res.count !== 1 || res.min < 3) continue;
    if (res.nodes < tier.nodes[0] || res.nodes > tier.nodes[1]) continue;
    seen.add(key);
    pool.push({ grid, res });
  }
  pool.sort((a, b) => a.res.nodes - b.res.nodes);
  // spread picks across the pool to get a gradual difficulty ramp
  const picks = [];
  for (let i = 0; i < tier.count && pool.length; i++) {
    picks.push(pool[Math.min(pool.length - 1, Math.floor((i + 0.5) * pool.length / tier.count))]);
  }
  console.error(`${tier.name}: pool ${pool.length}, nodes ${picks.map(p => p.res.nodes).join(',')}`);
  for (const { grid, res } of picks) {
    const C = grid[0].length;
    puzzles.push({
      difficulty: tier.name,
      grid,
      solution: res.solutions[0].map(i => [Math.floor(i / C), i % C]),
    });
  }
}

const out = '// Vygenerováno skriptem tools/generate.mjs – každá úloha má právě jedno řešení\n'
  + '// s minimálním počtem luceren. "." = volné pole, "#" = zeď, "G" = hlídač.\n'
  + 'window.PUZZLES = ' + JSON.stringify(puzzles.map((p, i) => ({ id: i + 1, ...p })), null, 1)
    .replace(/\[\n\s+(\d+),\n\s+(\d+)\n\s+\]/g, '[$1,$2]') + ';\n';
writeFileSync(new URL('../puzzles.js', import.meta.url), out);
console.error(`Wrote ${puzzles.length} puzzles`);
