import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const src = JSON.parse(fs.readFileSync(dir + '关卡7-金boss.json', 'utf8'));
const variants = [
  ['水', 2, [12, 13, 14, 15]],
  ['木', 1, [22, 23, 24, 25]],
  ['土', 4, [42, 43, 44, 45]],
  ['火', 3, [32, 33, 34, 35]],
];

for (const [name, attr, cells] of variants) {
  const levelName = `关卡7-${name}boss`;
  const target = dir + levelName + '.json';
  if (fs.existsSync(target)) throw new Error(`目标已存在，拒绝覆盖: ${target}`);
  const data = {
    v: 1,
    name: levelName,
    type: src.type,
    cells: src.cells.slice(),
    enemies: src.enemies.map(e => ({
      ...e,
      attr,
      cell: cells[0],
      cells: cells.slice(),
    })),
  };
  fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`created ${target} | type=${data.type} | attr=${attr} | cells=${cells.join(',')}`);
}
