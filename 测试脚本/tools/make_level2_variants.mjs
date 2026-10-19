import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const srcPath = dir + '关卡2-金.json';
const src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const variants = [
  ['水', 2, [20, 19, 18, 17]],
  ['木', 1, [30, 29, 28, 27]],
  ['土', 4, [50, 49, 48, 47]],
  ['火', 3, [40, 39, 38, 37]],
];

for (const [name, attr, cells] of variants) {
  const target = dir + `关卡2-${name}.json`;
  if (fs.existsSync(target)) {
    throw new Error(`目标已存在，拒绝覆盖: ${target}`);
  }
  const data = {
    v: 1,
    name: `关卡2-${name}`,
    type: src.type,
    cells: src.cells.slice(),
    enemies: src.enemies.map((e, i) => ({
      ...e,
      attr,
      cell: cells[i],
    })),
  };
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`created ${target} | attr=${attr} | cells=${cells.join(',')}`);
}
