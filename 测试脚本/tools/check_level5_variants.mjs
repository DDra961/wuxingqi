import path from 'node:path';
import fs from 'node:fs';

const R_OUT = 5 / (2 * Math.sin(Math.PI / 5));
const SECTOR = Math.PI * 2 / 5;
const REGION_ATTR = [0, 2, 1, 3, 4];
function vertex(e, scale = 1) {
  const a = -Math.PI / 2 + e * SECTOR;
  return { x: Math.cos(a) * R_OUT * scale, z: Math.sin(a) * R_OUT * scale };
}
const cells = [{ id: 0, region: -1, ring: 1, idx: 0, x: 0, z: 0, neighbors: [] }];
for (let e = 0; e < 5; e++) {
  const a = vertex(e);
  const b = vertex(e + 1);
  for (let s = 1; s <= 4; s++) {
    const f = s / 4;
    for (let k = 0; k < s; k++) {
      const t = (s - k) / s;
      const x = f * ((1 - t) * a.x + t * b.x);
      const z = f * ((1 - t) * a.z + t * b.z);
      cells.push({ id: cells.length, region: e, ring: s + 1, idx: k, x, z, neighbors: [] });
    }
  }
}
for (let i = 0; i < cells.length; i++) {
  for (let j = i + 1; j < cells.length; j++) {
    if (Math.hypot(cells[i].x - cells[j].x, cells[i].z - cells[j].z) <= 1.35) {
      cells[i].neighbors.push(j);
      cells[j].neighbors.push(i);
    }
  }
}

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const src = JSON.parse(fs.readFileSync(dir + '关卡5-金.json', 'utf8'));
const variants = [
  ['关卡5-水', 2, [13, 12]],
  ['关卡5-木', 1, [23, 22]],
  ['关卡5-土', 4, [43, 42]],
  ['关卡5-火', 3, [33, 32]],
];
for (const [name, attr, expected] of variants) {
  const d = JSON.parse(fs.readFileSync(dir + name + '.json', 'utf8'));
  const es = d.enemies;
  const statsOk = es.every((e, i) => ['template', 'hp', 'atk', 'def', 'sta', 'mana', 'atkRange'].every(k => e[k] === src.enemies[i][k]));
  const idsOk = es.every((e, i) => e.id === src.enemies[i].id);
  const attrsOk = es.every(e => e.attr === attr);
  const cellsOk = es.every((e, i) => e.cell === expected[i]);
  const ring3 = es.every(e => cells[e.cell].ring === 3);
  const regionAttr = es.every(e => REGION_ATTR[cells[e.cell].region] === attr);
  const pairAdj = cells[es[0].cell].neighbors.includes(es[1].cell);
  console.log(name,
    'nameOk=' + (d.name === name),
    'type=' + d.type,
    'cellsSame=' + (JSON.stringify(d.cells) === JSON.stringify(src.cells)),
    'enemies=' + es.length,
    'idsOk=' + idsOk,
    'templates=' + es.map(e => e.template).join(','),
    'statsOk=' + statsOk,
    'attrsOk=' + attrsOk,
    'cellsOk=' + cellsOk,
    'ring3=' + ring3,
    'regionAttrOk=' + regionAttr,
    'pairAdj=' + pairAdj,
    'cells=' + es.map(e => e.cell).join(','));
}
