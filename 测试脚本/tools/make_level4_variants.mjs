import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const src = JSON.parse(fs.readFileSync(dir + '关卡4-金.json', 'utf8'));
const anchors = new Set([1, 11, 21, 31, 41]);
const variants = [
  ['水', 2, [41, 21, 1, 11]],
  ['木', 1, [1, 31, 11, 21]],
  ['土', 4, [21, 1, 31, 41]],
  ['火', 3, [11, 41, 21, 31]],
];

for (const [name, base, positions] of variants) {
  const target = dir + `关卡4-${name}.json`;
  if (fs.existsSync(target)) throw new Error(`目标已存在，拒绝覆盖: ${target}`);
  const cells = src.cells.map((v, i) => {
    if (i === 0) return null;
    if (anchors.has(i)) return v;
    if (v === null) return null;
    return base;
  });
  const data = {
    v: 1,
    name: `关卡4-${name}`,
    type: src.type,
    cells,
    enemies: src.enemies.map((e, i) => ({ ...e, attr: base, cell: positions[i] })),
  };
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`created ${target} | type=${data.type} | base=${base} | enemyCells=${positions.join(',')}`);
}
