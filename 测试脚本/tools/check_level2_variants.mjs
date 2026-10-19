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
const src = JSON.parse(fs.readFileSync(dir + '关卡2-金.json', 'utf8'));
const variants = [
  ['关卡2-水', 2, [20, 19, 18, 17]],
  ['关卡2-木', 1, [30, 29, 28, 27]],
  ['关卡2-土', 4, [50, 49, 48, 47]],
  ['关卡2-火', 3, [40, 39, 38, 37]],
];
for (const [name, attr, expectedCells] of variants) {
  const d = JSON.parse(fs.readFileSync(dir + name + '.json', 'utf8'));
  const es = d.enemies;
  const statsOk = es.every(e => ['hp', 'atk', 'def', 'sta', 'mana', 'atkRange', 'template'].every(k => e[k] === src.enemies[0][k]));
  const idsOk = es.map(e => e.id).join(',') === src.enemies.map(e => e.id).join(',');
  const attrsOk = es.every(e => e.attr === attr);
  const cellSetOk = es.map(e => e.cell).slice().sort((a, b) => a - b).join(',') === expectedCells.slice().sort((a, b) => a - b).join(',');
  const ring5 = es.every(e => cells[e.cell].ring === 5);
  const regionAttr = es.every(e => REGION_ATTR[cells[e.cell].region] === attr);
  const chain = es.every((e, i) => i === 0 || cells[e.cell].neighbors.includes(es[i - 1].cell));
  console.log(name,
    'nameOk=' + (d.name === name),
    'type=' + d.type,
    'cellsSame=' + (JSON.stringify(d.cells) === JSON.stringify(src.cells)),
    'enemies=' + es.length,
    'ids=' + es.map(e => e.id).join(','),
    'idsOk=' + idsOk,
    'statsOk=' + statsOk,
    'attrsOk=' + attrsOk,
    'cellSetOk=' + cellSetOk,
    'ring5=' + ring5,
    'regionAttrOk=' + regionAttr,
    'chain=' + chain,
    'cells=' + es.map(e => e.cell).join(','));
}
