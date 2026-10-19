import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const elements = ['\u91d1', '\u6728', '\u6c34', '\u706b', '\u571f'];
for (const el of elements) {
  const file = dir + `\u5173\u53617-${el}boss.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const e of data.enemies) {
    if (e.template !== 5) continue;
    e.hp = 60;
    e.atk = 6;
    e.def = 6;
    e.sta = 0;
    e.mana = 12;
    e.atkRange = 3;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(file, 'boss=60/6/6/0/12/3');
}
