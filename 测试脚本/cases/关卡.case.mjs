/* ---- level integration test ---- */
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS: ' + msg);
  else { failed += 1; console.error('FAIL: ' + msg); }
}

const root = path.resolve(import.meta.dirname, '..', '..');
globalThis.fetch = async (url) => {
  const rel = decodeURIComponent(String(url).replace(/^\//, ''));
  const file = path.join(root, rel);
  const text = fs.readFileSync(file, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

function setupRun(layer, difficulty, seed = 20261018) {
  run.active = true;
  run.difficulty = difficulty;
  run.heroAttr = 0;
  run.companions = [COMPANION_MAP.nian, COMPANION_MAP.qian];
  run.rogue = new RogueRun(difficulty, 0);
  run.stageIndex = layer - 1;
  run.path = [run.rogue.options([])[0]];
  run.artifacts = [];
  run.grantedLayers = [];
  run.seed = seed;
  createPlayerUnits();
}

function gameEnemies() {
  return units.filter(u => u.camp === 1);
}

function baseStatsFromLevel(e) {
  return {
    hp: Number(e.hp),
    atk: Number(e.atk),
    def: Number(e.def),
    sta: Number(e.sta),
    mana: Number(e.mana),
    atkRange: Number(e.atkRange),
  };
}

setupRun(1, 5);
for (let layer = 1; layer <= 7; layer++) {
  const file = levelFileForLayer(layer);
  const nums = layer >= 7 ? [7] : [layer - 1, layer, layer + 1].filter(n => n >= 1 && n < 7);
  const re = layer >= 7
    ? /^关卡7-[金木水火土]boss\.json$/
    : new RegExp(`^关卡(?:${nums.join('|')})-[金木水火土]\\.json$`);
  assert(re.test(file), `layer ${layer} selects ${file}`);
  assert(fs.existsSync(path.join(root, '关卡集', file)), `layer ${layer} file exists`);
  if (layer < 7) {
    const num = Number(file.match(/^关卡(\d+)-/)[1]);
    assert(nums.includes(num), `layer ${layer} uses ${nums.join('/')} candidate, got ${num}`);
  }
  assert(levelFileForLayer(layer) === file, `layer ${layer} selection is deterministic`);
}
for (let layer = 1; layer <= 6; layer++) {
  const nums = [layer - 1, layer, layer + 1].filter(n => n >= 1 && n < 7);
  const seen = new Set();
  for (let seed = 0; seed < 300; seed++) {
    run.seed = seed;
    seen.add(Number(levelFileForLayer(layer).match(/^关卡(\d+)-/)[1]));
  }
  assert(nums.every(n => seen.has(n)), `layer ${layer} can produce all candidates ${nums.join('/')}`);
  assert(!seen.has(0) && !seen.has(7), `layer ${layer} never picks 0 or 7`);
}

setupRun(1, 5);
await enterBattle();
closeModal();
const l1 = run.battleLevel;
assert(!!l1 && l1.cells.length === 51, 'layer 1 loads a 51-cell level');
assert(/^关卡(1|2)-[金木水火土]\.json$/.test(l1.file || ''), 'layer 1 file is from 关卡1-* or 关卡2-*');
assert(cells.every((c, i) => c.baseAttr === (Number.isInteger(l1.cells[i]) ? l1.cells[i] : null)), 'level applies cell attributes');
assert(gameEnemies().length === l1.enemies.length && gameEnemies().length > 0, 'level enemy count is applied');
for (let i = 0; i < l1.enemies.length; i++) {
  const le = l1.enemies[i];
  const ge = gameEnemies()[i];
  const base = baseStatsFromLevel(le);
  assert(ge.templateId === le.template && ge.attr === le.attr, `layer 1 enemy ${i + 1} template/attr`);
  assert(ge.cell.id === le.cell, `layer 1 enemy ${i + 1} position`);
  assert(ge.maxHp === base.hp && ge.atk === base.atk && ge.def === base.def, `layer 1 enemy ${i + 1} stats at difficulty 5 layer 1`);
  assert(ge.maxSta === base.sta && ge.maxMana === base.mana && ge.atkRange === base.atkRange, `layer 1 enemy ${i + 1} resources/range`);
}

setupRun(6, 5);
await enterBattle();
closeModal();
const l6 = run.battleLevel;
const layerMul = 1 + (6 - 1) * CONFIG.scaling.layer;
const e6 = gameEnemies();
assert(e6.length === l6.enemies.length && e6.length > 0, 'layer 6 enemy count');
for (let i = 0; i < l6.enemies.length; i++) {
  const le = l6.enemies[i];
  const ge = e6[i];
  const base = baseStatsFromLevel(le);
  const expect = k => Math.max(0, Math.floor(Math.floor(base[k] * 1) * layerMul));
  assert(ge.maxHp === Math.max(1, expect('hp')), `layer 6 enemy ${i + 1} hp scales by layer`);
  assert(ge.atk === expect('atk') && ge.def === expect('def'), `layer 6 enemy ${i + 1} atk/def scale by layer`);
  assert(ge.maxSta === expect('sta') && ge.maxMana === expect('mana'), `layer 6 enemy ${i + 1} sta/mana scale by layer`);
  assert(ge.atkRange === base.atkRange, `layer 6 enemy ${i + 1} range is not scaled`);
}

setupRun(7, 5);
await enterBattle();
closeModal();
const l7 = run.battleLevel;
assert(!!l7 && /^关卡7-[金木水火土]boss\.json$/.test(l7.file || ''), 'layer 7 loads a boss level');
assert(gameEnemies().length === 1 && gameEnemies()[0].isBoss, 'boss level creates one boss unit');
const boss5 = gameEnemies()[0];
const bossBase = l7.enemies[0];
assert(boss5.templateId === 5, 'boss uses template 5');
assert(boss5.cells.map(c => c.id).join(',') === bossBase.cells.join(','), 'boss footprint comes from the level');
assert(boss5.maxHp === Number(bossBase.hp) && boss5.atk === Number(bossBase.atk), 'boss hp/atk use difficulty only');
assert(boss5.def === Number(bossBase.def) && boss5.maxMana === Number(bossBase.mana), 'boss def/mana use difficulty only');
assert(boss5.atkRange === Number(bossBase.atkRange), 'boss range comes from the level');

setupRun(7, 10);
await enterBattle();
closeModal();
const l7b = run.battleLevel;
const boss10 = gameEnemies()[0];
const b10 = l7b.enemies[0];
const bossDiff = v => Math.max(0, Math.floor(Number(v) * (CONFIG.scaling.base + (10 - 1) * CONFIG.scaling.difficulty)));
assert(boss10.maxHp === Math.max(1, bossDiff(b10.hp)), 'boss hp uses difficulty only at layer 7');
assert(boss10.atk === bossDiff(b10.atk) && boss10.def === bossDiff(b10.def), 'boss atk/def use difficulty only');
assert(boss10.maxMana === bossDiff(b10.mana), 'boss mana uses difficulty only');
assert(boss10.maxHp === 90, 'difficulty 10 boss hp is 90 (60 x 1.5, no layer multiplier)');

setupRun(1, 10);
await enterBattle();
closeModal();
const l1b = run.battleLevel;
const n10 = gameEnemies()[0];
const n1 = l1b.enemies[0];
const nd = v => Math.max(0, Math.floor(Number(v) * (CONFIG.scaling.base + (10 - 1) * CONFIG.scaling.difficulty)));
assert(n10.maxHp === Math.max(1, nd(n1.hp)) && n10.atk === nd(n1.atk), 'normal enemies also scale by difficulty');

console.log(failed ? `DONE with ${failed} failure(s)` : 'DONE all pass');
process.exit(failed ? 1 : 0);
