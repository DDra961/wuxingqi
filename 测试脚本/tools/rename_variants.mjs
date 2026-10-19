import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
for (const x of ['水', '火', '土', '木']) {
  const from = dir + `关卡2-${x}.json`;
  const to = dir + `关卡1-${x}.json`;
  if (!fs.existsSync(from)) {
    console.log(`SKIP ${from} (missing)`);
    continue;
  }
  if (fs.existsSync(to)) {
    throw new Error(`目标已存在，拒绝覆盖: ${to}`);
  }
  const data = JSON.parse(fs.readFileSync(from, 'utf8'));
  data.name = `关卡1-${x}`;
  fs.writeFileSync(to, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.unlinkSync(from);
  console.log(`${from} -> ${to} (name=${data.name})`);
}
