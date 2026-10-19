import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const src = JSON.parse(fs.readFileSync(dir + '关卡3-金.json', 'utf8'));
const variants = [
  ['水', 2, [13, 12, 15]],
  ['木', 1, [23, 22, 25]],
  ['土', 4, [43, 42, 45]],
  ['火', 3, [33, 32, 35]],
];

for (const [name, attr, cells] of variants) {
  const target = dir + `关卡3-${name}.json`;
  if (fs.existsSync(target)) throw new Error(`目标已存在，拒绝覆盖: ${target}`);
  const data = {
    v: 1,
    name: `关卡3-${name}`,
    type: src.type,
    cells: src.cells.slice(),
    enemies: src.enemies.map((e, i) => ({ ...e, attr, cell: cells[i] })),
  };
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`created ${target} | type=${data.type} | attr=${attr} | cells=${cells.join(',')}`);
}
