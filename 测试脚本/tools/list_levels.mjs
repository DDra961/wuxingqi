import path from 'node:path';
import fs from 'node:fs';
const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
for (const f of files) {
  try {
    const d = JSON.parse(fs.readFileSync(dir + f, 'utf8'));
    const ids = (d.enemies || []).map(e => e.id).join(',');
    const cells = (d.enemies || []).map(e => e.cell).join(',');
    const attrs = (d.enemies || []).map(e => e.attr).join(',');
    const tpls = (d.enemies || []).map(e => e.template).join(',');
    console.log(`${f} | name=${d.name} | type=${d.type} | cells=${(d.cells || []).length} | enemies=${(d.enemies || []).length} | ids=${ids} | cells=${cells} | attrs=${attrs} | tpls=${tpls}`);
  } catch (e) {
    console.log(f, 'PARSE ERROR', e.message);
  }
}
