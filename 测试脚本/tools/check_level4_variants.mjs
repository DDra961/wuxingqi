import path from 'node:path';
import fs from 'node:fs';

const dir = path.resolve(import.meta.dirname, '..', '..', '\u5173\u5361\u96c6') + '/';
const src = JSON.parse(fs.readFileSync(dir + '关卡4-金.json', 'utf8'));
const ANCHORS = [1, 11, 21, 31, 41];
const ANCHOR_ATTRS = [0, 2, 1, 3, 4];
const RING4_NULLS = [4, 5, 6, 14, 15, 16, 24, 25, 26, 34, 35, 36, 44, 45, 46];
const GEN = [2, 3, 1, 4, 0];
const BEATS = [1, 4, 3, 0, 2];
const NAME = ['金', '木', '水', '火', '土'];

function anchorFor(attr) {
  return ANCHORS[ANCHOR_ATTRS.indexOf(attr)];
}
function generatorOf(attr) {
  return GEN.findIndex(g => g === attr);
}
function generatedBy(attr) {
  return GEN[attr];
}
function conquerorOf(attr) {
  return BEATS.indexOf(attr);
}

function checkAt(name, base, expectedPositions, file) {
  const d = JSON.parse(fs.readFileSync(dir + file, 'utf8'));
  const errors = [];
  if (d.name !== name) errors.push('name');
  if (d.type !== '地形杀') errors.push('type');
  if (d.cells.length !== 51) errors.push('cells length');
  if (d.cells[0] !== null) errors.push('center');
  for (const id of RING4_NULLS) if (d.cells[id] !== null) errors.push('ring4 ' + id);
  for (let i = 0; i < ANCHORS.length; i++) {
    if (d.cells[ANCHORS[i]] !== ANCHOR_ATTRS[i]) errors.push('anchor ' + ANCHORS[i]);
  }
  for (let i = 1; i < 51; i++) {
    if (ANCHORS.includes(i) || RING4_NULLS.includes(i)) continue;
    if (d.cells[i] !== base) errors.push('base cell ' + i);
  }
  const es = d.enemies;
  if (es.length !== 4) errors.push('enemy count');
  if (es.map(e => e.id).join(',') !== '1,2,3,4') errors.push('enemy ids');
  if (es.map(e => e.template).join(',') !== src.enemies.map(e => e.template).join(',')) errors.push('templates');
  for (let i = 0; i < 4; i++) {
    for (const k of ['hp', 'atk', 'def', 'sta', 'mana', 'atkRange']) {
      if (es[i][k] !== src.enemies[i][k]) errors.push('stat ' + i + ' ' + k);
    }
  }
  if (!es.every(e => e.attr === base)) errors.push('enemy attrs');
  if (es.map(e => e.cell).join(',') !== expectedPositions.join(',')) errors.push('positions');
  const roles = {
    same: anchorFor(base),
    generator: anchorFor(generatorOf(base)),
    generated: anchorFor(generatedBy(base)),
    conqueror: anchorFor(conquerorOf(base)),
    empty: anchorFor(BEATS[base]),
  };
  if (es[3].cell !== roles.same) errors.push('id4 same anchor');
  if (es[2].cell !== roles.generator) errors.push('id3 generator anchor');
  if (es[1].cell !== roles.generated) errors.push('id2 generated anchor');
  if (es[0].cell !== roles.conqueror) errors.push('id1 conqueror anchor');
  const occupied = new Set(es.map(e => e.cell));
  if (occupied.has(roles.empty)) errors.push('empty anchor occupied');
  console.log(name,
    'base=' + NAME[base],
    'same=' + NAME[base] + '(' + roles.same + ')',
    'generator=' + NAME[generatorOf(base)] + '(' + roles.generator + ')',
    'generated=' + NAME[generatedBy(base)] + '(' + roles.generated + ')',
    'conqueror=' + NAME[conquerorOf(base)] + '(' + roles.conqueror + ')',
    'empty=' + NAME[BEATS[base]] + '(' + roles.empty + ')',
    'positions=' + es.map(e => e.cell).join(','),
    errors.length ? 'ERRORS=' + errors.join('|') : 'OK');
}

checkAt('关卡4-水', 2, [41, 21, 1, 11], '关卡4-水.json');
checkAt('关卡4-木', 1, [1, 31, 11, 21], '关卡4-木.json');
checkAt('关卡4-土', 4, [21, 1, 31, 41], '关卡4-土.json');
checkAt('关卡4-火', 3, [11, 41, 21, 31], '关卡4-火.json');
