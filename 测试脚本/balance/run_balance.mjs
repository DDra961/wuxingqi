import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGameCase, ROOT } from '../lib/build_game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = buildGameCase('balance', path.join(here, 'body.mjs'));
const result = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: ROOT });
if (result.status !== 0) process.exitCode = 1;
