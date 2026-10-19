import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..');
export const BUILD = path.join(here, '..', '.build');

function ensureBuild() {
  fs.mkdirSync(BUILD, { recursive: true });
}

function replaceGameSource(src) {
  const threeUrl = pathToFileURL(path.join(ROOT, '程序', 'three.module.js')).href;
  src = src.replace("import * as THREE from 'three';", `import * as THREE from '${threeUrl}';`);
  src = src.replace(
    /const renderer = new THREE\.WebGLRenderer\(\{[^}]*\}\);/,
    "const renderer = { domElement: document.createElement('canvas'), outputColorSpace: null, setPixelRatio() {}, setSize() {}, setClearColor() {}, render() {} };",
  );
  if (src.includes('new THREE.WebGLRenderer')) throw new Error('renderer not replaced');
  return src;
}

export function buildGameCase(name, bodyFile) {
  ensureBuild();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('game module script not found');
  const body = fs.readFileSync(bodyFile, 'utf8');
  const shimUrl = pathToFileURL(path.join(here, 'deploy_shim.mjs')).href;
  const out = [
    `import '${shimUrl}';`,
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    replaceGameSource(match[1]),
    body,
  ].join('\n');
  const file = path.join(BUILD, name + '.mjs');
  fs.writeFileSync(file, out, 'utf8');
  return file;
}

export function buildEditorCase(name, bodyFile) {
  ensureBuild();
  const html = fs.readFileSync(path.join(ROOT, '程序', 'level_editor.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('editor script not found');
  const body = fs.readFileSync(bodyFile, 'utf8');
  const shimUrl = pathToFileURL(path.join(here, 'editor_shim.mjs')).href;
  const out = [`import '${shimUrl}';`, match[1], body].join('\n');
  const file = path.join(BUILD, name + '.mjs');
  fs.writeFileSync(file, out, 'utf8');
  return file;
}
