// Solver for the lantern puzzle.
// Grid: array of strings, '.' = empty, '#' = wall, 'G' = guard.
// A lantern lights its whole row/column segment (until a wall or the border).
// Rules: every empty cell lit, no guard lit, no two lanterns see each other.

export function analyze(grid) {
  const R = grid.length, C = grid[0].length;
  const rowSeg = new Array(R * C).fill(-1);
  const colSeg = new Array(R * C).fill(-1);
  const segGuard = [];
  let seg = 0;
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (grid[r][c] === '#') continue;
      if (c === 0 || grid[r][c - 1] === '#') { segGuard[seg] = false; seg++; }
      rowSeg[r * C + c] = seg - 1;
      if (grid[r][c] === 'G') segGuard[seg - 1] = true;
    }
  }
  for (let c = 0; c < C; c++) {
    for (let r = 0; r < R; r++) {
      if (grid[r][c] === '#') continue;
      if (r === 0 || grid[r - 1][c] === '#') { segGuard[seg] = false; seg++; }
      colSeg[r * C + c] = seg - 1;
      if (grid[r][c] === 'G') segGuard[seg - 1] = true;
    }
  }
  const empties = [], candidates = [];
  for (let i = 0; i < R * C; i++) {
    const ch = grid[Math.floor(i / C)][i % C];
    if (ch !== '.') continue;
    empties.push(i);
    if (!segGuard[rowSeg[i]] && !segGuard[colSeg[i]]) candidates.push(i);
  }
  const cover = new Map();
  for (const e of empties) {
    cover.set(e, candidates.filter(l => rowSeg[l] === rowSeg[e] || colSeg[l] === colSeg[e]));
  }
  return { R, C, rowSeg, colSeg, segCount: seg, empties, candidates, cover };
}

// Returns { min, count, solutions (up to 2), nodes } – count of minimum solutions.
export function solve(grid, maxSolutions = 2) {
  const a = analyze(grid);
  const { rowSeg, colSeg, empties, cover } = a;
  for (const e of empties) if (cover.get(e).length === 0) return { min: Infinity, count: 0, solutions: [], nodes: 0 };

  const segUsed = new Uint8Array(a.segCount);
  const forbidden = new Uint8Array(a.R * a.C);
  const chosen = [];
  let best = Infinity, count = 0, nodes = 0;
  let solutions = [];

  const isCovered = e => segUsed[rowSeg[e]] || segUsed[colSeg[e]];
  const avail = l => !forbidden[l] && !segUsed[rowSeg[l]] && !segUsed[colSeg[l]];

  function rec() {
    nodes++;
    if (chosen.length > best) return;
    let pick = -1, pickOpts = null;
    let uncovered = 0;
    for (const e of empties) {
      if (isCovered(e)) continue;
      uncovered++;
      const opts = cover.get(e).filter(avail);
      if (opts.length === 0) return;
      if (!pickOpts || opts.length < pickOpts.length) { pick = e; pickOpts = opts; }
    }
    if (pick === -1) {
      const n = chosen.length;
      if (n < best) { best = n; count = 0; solutions = []; }
      count++;
      if (solutions.length < maxSolutions) solutions.push([...chosen].sort((x, y) => x - y));
      return;
    }
    if (chosen.length + 1 > best) return;
    const forbade = [];
    for (const l of pickOpts) {
      segUsed[rowSeg[l]] = 1; segUsed[colSeg[l]] = 1; chosen.push(l);
      rec();
      chosen.pop(); segUsed[rowSeg[l]] = 0; segUsed[colSeg[l]] = 0;
      forbidden[l] = 1; forbade.push(l);
    }
    for (const l of forbade) forbidden[l] = 0;
  }
  rec();
  return { min: best, count, solutions, nodes };
}
