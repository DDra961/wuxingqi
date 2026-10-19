const ROOT = process.cwd();
const LEVEL_DIR = path.join(ROOT, '关卡集');
const OUT_DIR = path.join(ROOT, '测试脚本', 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });
logEl.appendChild = () => {};

const HERO_NAMES = ['金', '木', '水', '火', '土'];
const PAIRS = [
  ['shen', 'qian'], ['shen', 'nian'], ['shen', 'chi'],
  ['qian', 'nian'], ['qian', 'chi'], ['nian', 'chi'],
];
const ELEMENTS = ['金', '木', '水', '火', '土'];
const DIFFICULTY = 5;
const SEEDS = [20261018, 20261019];
const TRIALS = 20;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(seed, trial, layer) {
  let h = 2166136261;
  for (const n of [seed, trial, layer]) {
    h ^= n + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function levelPath(file) {
  return path.join(LEVEL_DIR, file);
}

function loadLevel(file) {
  const p = levelPath(file);
  if (!fs.existsSync(p)) throw new Error(`missing level ${file}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function makeSequence(seed) {
  run.seed = seed;
  run.rogue = null;
  const files = [];
  for (let layer = 1; layer <= 7; layer++) files.push(levelFileForLayer(layer));
  return files;
}

function deployTestParty(enemies) {
  const occupied = new Set();
  for (const e of enemies) for (const c of unitCells(e)) occupied.add(c.id);
  for (const u of playerUnits) {
    const region = REGION_ATTR.indexOf(u.attr);
    let chosen = null;
    const start = cells.find(c => c.region === region && c.ring === 2);
    if (start && !occupied.has(start.id)) chosen = start;
    for (let ring = 3; ring <= 5 && !chosen; ring++) {
      const candidates = cells.filter(c => c.ring === ring).sort((a, b) => a.id - b.id);
      chosen = candidates.find(c => !occupied.has(c.id)) || null;
    }
    if (!chosen) chosen = cells.find(c => !occupied.has(c.id));
    if (!chosen) continue;
    u.cell = chosen;
    occupied.add(chosen.id);
  }
}

function resetBattle(level, layer, attr, pair, seed, trial) {
  run.active = true;
  run.difficulty = DIFFICULTY;
  run.heroAttr = attr;
  run.companions = pair.map(id => COMPANION_MAP[id]);
  run.rogue = null;
  run.stageIndex = layer - 1;
  run.path = [];
  run.artifacts = [];
  run.grantedLayers = [];
  run.battleLevel = level;
  run.seed = seed;
  Math.random = mulberry32(hashSeed(seed, trial, layer));

  createPlayerUnits();
  applyLevelCells(level);
  const enemies = buildLevelEnemies(level, layer);
  deployTestParty(enemies);
  playerUnits.forEach(u => {
    u.hp = u.maxHp;
    u.sta = u.maxSta;
    u.mana = u.maxMana;
    u.alive = true;
    u.damageThisRound = 0;
    u.damageImmune = false;
    u.skipped = false;
    u.tauntUsed = false;
    u.skillCostUses = {};
    u.skillOnceUsed = {};
    u.status = new UnitStatus();
    u.battleSnapshot = { atk: u.atk, def: u.def, maxDef: u.maxDef, maxSta: u.maxSta, maxMana: u.maxMana };
  });
  enemies.forEach(e => { e.alive = true; });
  units = [...playerUnits, ...enemies];
  Object.assign(state, {
    round: 1, phase: 'decision', over: false, onceUsed: false,
    decisions: {}, currentUnitId: null, winner: null, reason: null,
  });
}

function nearestFoe(u) {
  const foes = units.filter(x => x.alive && x.camp !== u.camp);
  if (!foes.length) return null;
  return foes.reduce((a, b) => (stepDist(u.cell, a.cell) <= stepDist(u.cell, b.cell) ? a : b));
}

function attributeReady(u, t) {
  const { attCell, tgtCell } = attackCellPair(u, t, undefined);
  const attrAdv = BEATS[u.attr] === t.attr;
  const cellAdv = attCell.attr !== null && tgtCell.attr !== null && BEATS[attCell.attr] === tgtCell.attr;
  return attrAdv || cellAdv;
}

function attackScore(u, t, s) {
  if (s.id === 18) return attributeReady(u, t) ? u.atk * 3 : 0;
  if (s.id === 21) return t.mana;
  if (s.id === 22) return u.atk * 3;
  if (s.id === 26) return Math.floor(u.atk / 2);
  if (s.id === 28 || s.id === 30) return u.atk;
  if (s.id === 31) return Math.floor(u.mana * 3 / 2);
  return u.atk;
}

function bestAttack(u) {
  let best = null;
  for (const id of u.skills) {
    const s = SKILL_MAP[id];
    if (!s || s.type !== 'attack' || !affordable(u, s)) continue;
    for (const t of validTargets(u, s)) {
      const score = attackScore(u, t, s);
      if (score <= 0) continue;
      if (!best || score > best.score || (score === best.score && t.hp < best.target.hp)) {
        best = { skillId: id, targetUnitId: t.id, score, target: t, skill: s };
      }
    }
  }
  return best;
}

function allyTarget(u, skill, prefer = 'lowHp') {
  const list = validTargets(u, skill);
  if (!list.length) return null;
  if (prefer === 'highAtk') return list.reduce((a, b) => (b.atk > a.atk ? b : a));
  return list.reduce((a, b) => (b.hp < a.hp ? b : a));
}

function chooseDecision(u) {
  const foes = units.filter(x => x.alive && x.camp !== u.camp);
  if (!foes.length) return { skillId: 1 };

  const atk = bestAttack(u);
  if (atk) return { skillId: atk.skillId, targetUnitId: atk.targetUnitId };

  const nearest = nearestFoe(u);
  const inRange = nearest && unitGap(u, nearest) <= u.atkRange;

  if (u.charId === 'hero' && u.attr === 1 && u.hp < u.maxHp * 0.65) {
    const s = SKILL_MAP[20];
    if (affordable(u, s)) return { skillId: 20 };
  }

  if (nearest && !inRange) {
    const step = nearestStepTo(u, nearest);
    if (step) return { skillId: 16, targetCellId: step.id };
  }

  if (inRange && !affordable(u, SKILL_MAP[0])) return { skillId: 4 };

  if (u.charId === 'hero' && u.attr === 4 && !u.skillOnceUsed[23] && inRange && u.hp < u.maxHp) {
    return { skillId: 23 };
  }
  if (u.charId === 'hero' && u.attr === 0) {
    const s = SKILL_MAP[19];
    if (affordable(u, s)) return { skillId: 19 };
  }

  if (u.charId === 'shen') {
    if (inRange && !u.skillOnceUsed[24] && u.hp < u.maxHp * 0.8) return { skillId: 24 };
    const armor = SKILL_MAP[25];
    if (state.round <= 2 && affordable(u, armor)) return { skillId: 25 };
  }

  if (u.charId === 'qian') {
    const lowHp = playerUnits.filter(p => p.alive && p.hp < p.maxHp * 0.8).sort((a, b) => a.hp - b.hp)[0];
    if (lowHp) {
      const nature = SKILL_MAP[27];
      if (affordable(u, nature)) {
        const t = allyTarget(u, nature);
        if (t) return { skillId: 27, targetUnitId: t.id };
      }
    }
  }

  if (u.charId === 'nian') {
    const tide = SKILL_MAP[29];
    if (affordable(u, tide)) {
      const t = allyTarget(u, tide, 'highAtk');
      if (t) return { skillId: 29, targetUnitId: t.id };
    }
  }

  const heal = SKILL_MAP[17];
  if (affordable(u, heal)) {
    const t = playerUnits.filter(p => p.alive && p.sta < p.maxSta).sort((a, b) => a.sta - b.sta)[0];
    if (t) return { skillId: 17, targetUnitId: t.id };
  }

  if (nearest) {
    const step = nearestStepTo(u, nearest);
    if (step) return { skillId: 16, targetCellId: step.id };
  }
  return { skillId: 1 };
}

function startSimRound() {
  state.phase = 'decision';
  state.decisions = {};
  state.onceUsed = false;
  for (const u of units) {
    if (!u.alive) continue;
    u.damageThisRound = 0;
    u.damageImmune = false;
    u.skipped = false;
    u.tauntUsed = false;
    if (!u.status.isNormal) {
      if (u.status.blocksDecision) u.skipped = true;
      u.status.tick(u);
    }
  }
  for (const u of units) {
    if (u.alive && !u.skipped && u.camp === 1) state.decisions[u.id] = npcDecide(u);
  }
  for (const u of playerUnits) {
    if (u.alive && !u.skipped) state.decisions[u.id] = chooseDecision(u);
  }
}

function resolveSimRound() {
  const order = units.filter(u => u.alive).sort((a, b) => a.id - b.id);
  for (const u of order) {
    if (!u.alive || u.skipped) continue;
    const d = state.decisions[u.id];
    if (!d) continue;
    const act = d.action ? ENEMY_ACTIONS[d.action] : null;
    const s = d.skillId !== undefined ? SKILL_MAP[d.skillId] : null;
    if (!act && !s) continue;
    if (act) act.run(u, d);
    else if (s.type !== 'defend') METHODS[s.method]?.(u, d, s);
  }
  for (const u of units) if (u.isBoss) bossEndRound(u);
}

function battleResult() {
  const mine = playerUnits.filter(u => u.alive).length;
  const foes = units.filter(u => u.alive && u.camp === 1).length;
  if (mine === 0 || foes === 0) {
    state.over = true;
    state.winner = mine === 0 && foes === 0 ? 'draw' : (foes === 0 ? 0 : 1);
    return;
  }
  if (state.round >= MAX_ROUNDS) {
    state.over = true;
    state.winner = 1;
    state.reason = 'rounds';
  }
}

function simulateBattle(level, layer, attr, pair, seed, trial) {
  resetBattle(level, layer, attr, pair, seed, trial);
  let rounds = 0;
  while (!state.over && rounds < MAX_ROUNDS) {
    rounds += 1;
    state.round = rounds;
    startSimRound();
    resolveSimRound();
    battleResult();
    if (state.over) break;
  }
  return {
    win: state.winner === 0,
    draw: state.winner === 'draw',
    rounds,
    playersAlive: playerUnits.filter(u => u.alive).length,
    enemyAlive: units.filter(u => u.alive && u.camp === 1).length,
  };
}

function simulateCampaign(attr, pair, seed, trial) {
  const files = makeSequence(seed);
  const levels = files.map(loadLevel);
  const battleWins = [];
  const battleRounds = [];
  let cleared = 0;
  for (let i = 0; i < levels.length; i++) {
    const r = simulateBattle(levels[i], i + 1, attr, pair, seed, trial);
    battleWins.push(r.win);
    battleRounds.push(r.rounds);
    if (!r.win) break;
    cleared += 1;
  }
  return {
    files,
    battleWins,
    battleRounds,
    cleared,
    finalWin: cleared === 7,
    totalRounds: battleRounds.reduce((n, v) => n + v, 0),
  };
}

const records = [];
for (let attr = 0; attr < 5; attr++) {
  for (const pair of PAIRS) {
    for (const seed of SEEDS) {
      for (let trial = 0; trial < TRIALS; trial++) {
        const r = simulateCampaign(attr, pair, seed, trial);
        records.push({
          hero: HERO_NAMES[attr],
          pair: pair.join('+'),
          seed,
          trial,
          levels: r.files.join('|'),
          wins: r.battleWins.map(v => v ? 'W' : 'L').join('|'),
          rounds: r.battleRounds.join('|'),
          battleWins: r.battleWins,
          battleRounds: r.battleRounds,
          cleared: r.cleared,
          finalWin: r.finalWin,
          totalRounds: r.totalRounds,
        });
      }
    }
  }
}

function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; }
function group(key) {
  const map = new Map();
  for (const r of records) {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}
function finalStats(list) {
  const wins = list.filter(r => r.finalWin).length;
  return {
    n: list.length,
    wins,
    rate: pct(wins, list.length),
    avgCleared: (list.reduce((n, r) => n + r.cleared, 0) / list.length).toFixed(2),
    avgRounds: (list.reduce((n, r) => n + r.totalRounds, 0) / list.length).toFixed(1),
  };
}

const lines = [];
lines.push('# 7 层顺序通关模拟');
lines.push('');
lines.push('## 测试方式');
lines.push('');
lines.push(`- 难度 ${DIFFICULTY}`);
lines.push('- 5 主角属性 × 6 队友组合 × 2 个种子 × 每个种子 20 次 = 1200 轮');
lines.push('- 每轮先用「种子 + 层号」生成 7 层关卡，再按第 1~7 层顺序战斗');
lines.push('- 第 1~6 层层号在 当前层±1 中随机，排除 0/7；第 7 层为 BOSS');
lines.push('- 基础队伍，不带藏品 / 求签 / 结算 / 关外成长；每场资源重置');
lines.push('- 测试站位：二环自己属性节点优先，被占用则逐环外扩、同环按 ID 尝试');
lines.push('- 失败即停止该轮；记录每层关卡、战斗结果、到达层数和总回合');
lines.push('');
const total = finalStats(records);
lines.push('## 总体');
lines.push('');
lines.push(`- 完整 7 层通关：${total.wins}/${total.n}（${total.rate}）`);
lines.push(`- 平均到达层数：${total.avgCleared}`);
lines.push(`- 平均总回合：${total.avgRounds}`);
lines.push('');

lines.push('## 每层战斗通过率');
lines.push('');
lines.push('| 层 | 到达轮次 | 本层获胜 | 本层胜率 |');
lines.push('|---:|---:|---:|---:|');
for (let layer = 1; layer <= 7; layer++) {
  const reached = records.filter(r => r.battleWins.length >= layer).length;
  const wins = records.filter(r => r.battleWins[layer - 1] === true).length;
  lines.push(`| ${layer} | ${reached} | ${wins} | ${pct(wins, reached)} |`);
}
lines.push('');

lines.push('## 按主角属性');
lines.push('');
lines.push('| 属性 | 轮次 | 完整通关 | 通关率 | 平均到达层 |');
lines.push('|---|---:|---:|---:|---:|');
for (const [hero, list] of group(r => r.hero)) {
  const s = finalStats(list);
  lines.push(`| ${hero} | ${s.n} | ${s.wins} | ${s.rate} | ${s.avgCleared} |`);
}
lines.push('');

lines.push('## 按队友组合');
lines.push('');
lines.push('| 组合 | 轮次 | 完整通关 | 通关率 | 平均到达层 |');
lines.push('|---|---:|---:|---:|---:|');
for (const [pair, list] of group(r => r.pair)) {
  const s = finalStats(list);
  lines.push(`| ${pair} | ${s.n} | ${s.wins} | ${s.rate} | ${s.avgCleared} |`);
}
lines.push('');

lines.push('## 到达层数分布');
lines.push('');
lines.push('| 到达层 | 轮次 | 占比 |');
lines.push('|---:|---:|---:|');
const clearedGroups = group(r => r.cleared);
for (let c = 0; c <= 7; c++) {
  const list = clearedGroups.get(c) || [];
  lines.push(`| ${c === 7 ? '完整 7 层' : c + ' 层后失败'} | ${list.length} | ${pct(list.length, records.length)} |`);
}
lines.push('');

lines.push('## 说明');
lines.push('');
lines.push('- 每轮先固定生成 7 个关卡文件，再顺序战斗，不遍历所有关卡搭配。');
lines.push('- 同一 seed 下的 20 次测试使用相同关卡序列，战斗随机种子按 trial/layer 变化。');
lines.push('- 该模拟不执行战后成长、求签和结算，因此是基础队伍顺序推进测试。');

const header = ['hero', 'pair', 'seed', 'trial', 'levels', 'wins', 'rounds', 'cleared', 'finalWin', 'totalRounds'];
const csv = [header.join(',')].concat(records.map(r => header.map(k => String(r[k] ?? '')).join(','))).join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'campaign_results.csv'), '\ufeff' + csv, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, 'campaign_summary.md'), lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
console.log(`\n输出：${path.join(OUT_DIR, 'campaign_results.csv')}`);
console.log(`输出：${path.join(OUT_DIR, 'campaign_summary.md')}`);
