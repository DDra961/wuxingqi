/* ---- level editor test ---- */
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS: ' + msg);
  else { failed += 1; console.error('FAIL: ' + msg); }
}

localStorage.clear();
level = blankLevel();
selectedId = null;
renderAll();

assert(CELLS.length === 51, 'board has 51 cells');
const ringCounts = [1, 2, 3, 4, 5].map(r => CELLS.filter(c => c.ring === r).length);
assert(ringCounts.join(',') === '1,5,10,15,20', 'rings contain 1/5/10/15/20 cells');
assert(SPIRAL[0].id === 0, 'spawn order starts at center');
assert(SPIRAL.every((c, i) => i === 0 || SPIRAL[i - 1].ring <= c.ring), 'spawn order is ring by ring');
assert(blankLevel().cells.every(v => v === null), 'new level starts with no attributes');

level = blankLevel();
cycleCell(10);
assert(level.cells[10] === 0, 'cycle none -> metal');
cycleCell(10); cycleCell(10); cycleCell(10);
assert(level.cells[10] === 3, 'cycle continues through 木/水/火');
cycleCell(10);
assert(level.cells[10] === 4, 'cycle reaches earth');
cycleCell(10);
assert(level.cells[10] === null, 'cycle returns to none');

level = blankLevel();
selectedId = null;
renderAll();
addEnemy();
assert(level.enemies.length === 1 && level.enemies[0].cell === 0, 'first enemy spawns at center');
assert(level.enemies[0].hp === 1 && level.enemies[0].atk === 1 && level.enemies[0].def === 1, 'new enemy defaults hp/atk/def to 1');
assert(level.enemies[0].mana === 1 && level.enemies[0].sta === 1 && level.enemies[0].atkRange === 1, 'new enemy defaults mana/sta/range to 1');
assert(level.enemies[0].template === 1 && level.enemies[0].attr === 0, 'new enemy defaults to template 1 and metal');
assert(board.innerHTML.includes('data-enemy="1"'), 'board renders enemy token');
addEnemy();
assert(CELLS[level.enemies[1].cell].ring === 2, 'second enemy spawns on the next ring');
for (let i = 0; i < 4; i++) addEnemy();
addEnemy();
assert(level.enemies.length === 7, 'seven enemies placed');
assert(CELLS[level.enemies[6].cell].ring === 3, 'seventh enemy moves to ring 3');

level = blankLevel();
level.name = '测试关';
level.type = '攻坚';
level.cells[7] = 3;
addEnemy();
const raw = serialize();
const norm = normalizeLevel(raw, true);
assert(norm.name === '测试关' && norm.type === '攻坚', 'name and type round-trip');
assert(norm.cells.length === 51 && norm.cells[7] === 3, 'cell attributes round-trip');
assert(norm.enemies.length === 1 && norm.enemies[0].cell === 0, 'enemies round-trip');

let threw = false;
try { normalizeLevel({ cells: [] }, true); } catch (e) { threw = true; }
assert(threw, 'strict import rejects incomplete cell data');

const clamped = normalizeLevel({
  name: 'x', type: '??', cells: new Array(51).fill(9),
  enemies: [{ cell: 0, template: 99, attr: 9, hp: -5, atk: 'x', def: 2.7, mana: -1, sta: 0, atkRange: 0 }],
}, true);
assert(clamped.cells.every(v => v === null), 'invalid cell values fall back to none');
assert(clamped.type === '大平面', 'invalid level type falls back to default');
assert(clamped.enemies[0].template === 1 && clamped.enemies[0].attr === 0, 'invalid template/attr fall back');
assert(clamped.enemies[0].hp === 1 && clamped.enemies[0].atk === 1 && clamped.enemies[0].def === 3, 'numbers are clamped and rounded');
assert(clamped.enemies[0].atkRange === 1, 'attack range minimum is 1');

level = blankLevel();
selectedId = null;
renderAll();
addEnemy();
const target = CELLS[1];
onBoardPointerDown({
  button: 0, pointerId: 7, clientX: 0, clientY: 0,
  target: { closest: sel => (sel === '[data-enemy]' ? { dataset: { enemy: '1' } } : null) },
  preventDefault() {},
});
onDragMove({ pointerId: 7, clientX: target.sx, clientY: target.sy });
onDragUp({ pointerId: 7 });
assert(level.enemies[0].cell === 1, 'dragging moves an enemy to the target cell');

addEnemy();
const occupied = level.enemies[1].cell;
const before = level.enemies[0].cell;
onBoardPointerDown({
  button: 0, pointerId: 8, clientX: 0, clientY: 0,
  target: { closest: sel => (sel === '[data-enemy]' ? { dataset: { enemy: '1' } } : null) },
  preventDefault() {},
});
onDragMove({ pointerId: 8, clientX: CELLS[occupied].sx, clientY: CELLS[occupied].sy });
onDragUp({ pointerId: 8 });
assert(level.enemies[0].cell === before, 'dragging onto an occupied cell is rejected');

const count = level.enemies.length;
deleteEnemy(level.enemies[0].id);
assert(level.enemies.length === count - 1, 'delete removes an enemy');

level.name = '保存测试';
saveNow(true);
const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
assert(saved.name === '保存测试' && saved.cells.length === 51, 'save stores the current level');
assert(saved.enemies.length === level.enemies.length, 'save stores enemies');

localStorage.setItem(SAVE_KEY, JSON.stringify({
  v: 1, name: '读档', type: '地形杀', cells: new Array(51).fill(null), enemies: [],
}));
const restored = loadFromStorage();
assert(restored && level.name === '读档' && level.type === '地形杀', 'load restores the saved level');

level.name = '文件夹测试';
let posted = null;
globalThis.fetch = async (url, opts) => {
  posted = { url, body: JSON.parse(opts.body) };
  return { ok: true, status: 200, json: async () => ({ ok: true, file: '关卡集/文件夹测试.json', overwrote: false }) };
};
await saveLevelToFolder();
assert(posted && posted.url === '/__save_level' && posted.body.name === '文件夹测试', 'folder save posts level JSON');
assert(posted.body.cells.length === 51 && Array.isArray(posted.body.enemies), 'folder save posts full level data');

level = blankLevel();
selectedId = null;
renderAll();
assert(TEMPLATES[5] && TEMPLATES[5].boss, 'boss template exists');
addBoss();
const bossEnemy = level.enemies.find(e => e.template === 5);
assert(!!bossEnemy && bossEnemy.cells.length === 4, 'boss is created with four cells');
assert(bossEnemy.cells.slice().sort((a, b) => a - b).join(',') === '1,2,3,41', 'boss uses the preferred diamond');
assert(bossEnemy.cell === bossEnemy.cells[0], 'boss primary cell follows the footprint');
assert(bossEnemy.hp === 60 && bossEnemy.atk === 6 && bossEnemy.def === 6, 'boss defaults hp/atk/def');
assert(bossEnemy.sta === 0 && bossEnemy.mana === 12 && bossEnemy.atkRange === 3, 'boss defaults sta/mana/range');
assert(board.innerHTML.includes('boss-footprint'), 'board renders boss footprint');
assert(listEl.innerHTML.includes('四格菱形'), 'enemy card shows boss footprint');

const bossCells = new Set(bossEnemy.cells);
addEnemy();
const normalEnemy = level.enemies.find(e => e.template === 1);
assert(!!normalEnemy && !bossCells.has(normalEnemy.cell), 'normal enemy avoids the boss footprint');

const rawBoss = serialize();
const rawBossEntry = rawBoss.enemies.find(e => e.template === 5);
assert(rawBossEntry && rawBossEntry.cells.length === 4, 'boss serialize includes its four cells');
const normBoss = normalizeLevel(rawBoss, true);
const normBossEntry = normBoss.enemies.find(e => e.template === 5);
assert(normBossEntry && normBossEntry.cells.length === 4 && normBossEntry.cell === normBossEntry.cells[0], 'boss normalize preserves the footprint');

const bossTarget = DIAMONDS.find(ids =>
  ids.join(',') !== bossEnemy.cells.join(',') &&
  diamondFree(ids, bossEnemy.id) &&
  !ids.includes(normalEnemy.cell));
assert(!!bossTarget, 'a second free diamond exists');
const from = diamondCentroid(bossEnemy.cells);
const to = diamondCentroid(bossTarget);
onBoardPointerDown({
  button: 0, pointerId: 9, clientX: from.x, clientY: from.y,
  target: { closest: sel => (sel === '[data-enemy]' ? { dataset: { enemy: String(bossEnemy.id) } } : null) },
  preventDefault() {},
});
onDragMove({ pointerId: 9, clientX: to.x, clientY: to.y });
onDragUp({ pointerId: 9 });
assert(bossEnemy.cells.join(',') === bossTarget.join(','), 'dragging moves the boss to another free diamond');
assert(!bossEnemy.cells.includes(normalEnemy.cell), 'dragged boss does not overlap the normal enemy');

console.log(failed ? `DONE with ${failed} failure(s)` : 'DONE all pass');
process.exit(failed ? 1 : 0);
