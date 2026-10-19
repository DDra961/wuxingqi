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
const src = JSON.parse(fs.readFileSync(dir + '关卡7-金boss.json', 'utf8'));
const variants = [
  ['关卡7-水boss', 2, [12, 13, 14, 15]],
  ['关卡7-木boss', 1, [22, 23, 24, 25]],
  ['关卡7-土boss', 4, [42, 43, 44, 45]],
  ['关卡7-火boss', 3, [32, 33, 34, 35]],
];
for (const [name, attr, expected] of variants) {
  const d = JSON.parse(fs.readFileSync(dir + name + '.json', 'utf8'));
  const es = d.enemies;
  const e = es[0];
  const statsOk = ['template', 'hp', 'atk', 'def', 'sta', 'mana', 'atkRange'].every(k => e[k] === src.enemies[0][k]);
  const cellsOk = e.cells.join(',') === expected.join(',');
  const primaryOk = e.cell === expected[0];
  const rings = expected.map(id => cells[id].ring).sort((a, b) => a - b);
  const ringOk = rings.join(',') === '3,3,4,4';
  const regionAttr = expected.every(id => REGION_ATTR[cells[id].region] === attr);
  const cycleOk = expected.every((id, i) => {
    const next = expected[(i + 1) % 4];
    return cells[id].neighbors.includes(next);
  });
  const boardSame = JSON.stringify(d.cells) === JSON.stringify(src.cells);
  console.log(name,
    'nameOk=' + (d.name === name),
    'type=' + d.type,
    'boardSame=' + boardSame,
    'enemies=' + es.length,
    'id=' + e.id,
    'template=' + e.template,
    'statsOk=' + statsOk,
    'attr=' + e.attr + '/' + attr,
    'cellsOk=' + cellsOk,
    'primaryOk=' + primaryOk,
    'ringOk=' + ringOk,
    'regionAttrOk=' + regionAttr,
    'cycleOk=' + cycleOk,
    'cells=' + e.cells.join(','));
}
