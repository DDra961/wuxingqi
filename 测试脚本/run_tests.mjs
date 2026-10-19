import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGameCase, buildEditorCase } from './lib/build_game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const cases = [
  ['机制', 'mechanism', '机制.case.mjs', 'game'],
  ['模板', 'templates', '模板.case.mjs', 'game'],
  ['关卡', 'levels', '关卡.case.mjs', 'game'],
  ['布阵', 'deploy', '布阵.case.mjs', 'game'],
  ['编辑器', 'editor', '编辑器.case.mjs', 'editor'],
];

let failed = 0;
for (const [label, name, body, kind] of cases) {
  const bodyFile = path.join(here, 'cases', body);
  const file = kind === 'editor'
    ? buildEditorCase(name, bodyFile)
    : buildGameCase(name, bodyFile);
  console.log(`\n===== ${label} =====`);
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n${failed} test case(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nALL TEST CASES PASSED');
}
