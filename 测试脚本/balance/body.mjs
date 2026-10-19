/* 数值模拟回归：基础队伍（不带藏品/成长），难度 5，随机种子固定 */
const ROOT = process.cwd();
const LEVEL_DIR = path.join(ROOT, '关卡集');
const OUT_DIR = path.join(ROOT, '测试脚本', 'output');
fs.mkdirSync(OUT_DIR, { recursive: true });
logEl.appendChild = () => {};

const requestedGrowth = Number(process.env.LAYER_GROWTH);
if (Number.isFinite(requestedGrowth)) CONFIG.scaling.layer = requestedGrowth;
const OUT_TAG = process.env.OUT_TAG ? String(process.env.OUT_TAG).replace(/[^\w-]/g, '') : '';

const HERO_NAMES = ['金', '木', '水', '火', '土'];
const PAIRS = [
  ['shen', 'qian'], ['shen', 'nian'], ['shen', 'chi'],
  ['qian', 'nian'], ['qian', 'chi'], ['nian', 'chi'],
];
const ELEMENTS = ['金', '木', '水', '火', '土'];
const DIFFICULTY = 5;
const SEEDS = 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedFor(attr, pairIndex, layer, elementIndex, seedIndex) {
  let h = 2166136261;
  for (const n of [attr, pairIndex, layer, elementIndex, seedIndex]) {
    h ^= n + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
      const candidates = cells
        .filter(c => c.ring === ring)
        .sort((a, b) => a.id - b.id);
      chosen = candidates.find(c => !occupied.has(c.id)) || null;
    }
    if (!chosen) chosen = cells.find(c => !occupied.has(c.id));
    if (!chosen) continue;
    u.cell = chosen;
    occupied.add(chosen.id);
  }
}

function resetBattle(level, layer, attr, pair, seed) {
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
  Math.random = mulberry32(seed);

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

  // 主角主属性专属：低血时优先自保 / 恢复
  if (u.charId === 'hero' && u.attr === 1 && u.hp < u.maxHp * 0.65) {
    const s = SKILL_MAP[20];
    if (affordable(u, s)) return { skillId: 20 };
  }

  // 不在攻击距离内时先接近，避免原地加 buff 浪费回合
  if (nearest && !inRange) {
    const step = nearestStepTo(u, nearest);
    if (step) return { skillId: 16, targetCellId: step.id };
  }

  // 已接近但魔力不足时先回元，否则会一直站着
  if (inRange && !affordable(u, SKILL_MAP[0])) {
    return { skillId: 4 };
  }

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

function simulate(level, layer, attr, pair, seed) {
  resetBattle(level, layer, attr, pair, seed);
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
    enemiesAlive: units.filter(u => u.alive && u.camp === 1).length,
    playerHp: playerUnits.reduce((n, u) => n + Math.max(0, u.hp), 0),
  };
}

const levels = [];
for (let layer = 1; layer <= 7; layer++) {
  for (const el of ELEMENTS) {
    const name = layer === 7 ? `关卡7-${el}boss.json` : `关卡${layer}-${el}.json`;
    const file = path.join(LEVEL_DIR, name);
    if (!fs.existsSync(file)) continue;
    levels.push({ layer, el, name, data: JSON.parse(fs.readFileSync(file, 'utf8')) });
  }
}

const rows = [];
for (const level of levels) {
  for (let attr = 0; attr < 5; attr++) {
    for (let pi = 0; pi < PAIRS.length; pi++) {
      for (let si = 0; si < SEEDS; si++) {
        const seed = seedFor(attr, pi, level.layer, level.el.charCodeAt(0), si);
        const r = simulate(level.data, level.layer, attr, PAIRS[pi], seed);
        rows.push({
          layer: level.layer,
          file: level.name,
          boss: level.layer === 7,
          hero: HERO_NAMES[attr],
          pairs: PAIRS[pi].join('+'),
          seed: si,
          ...r,
        });
      }
    }
  }
}

function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '—'; }
function group(rows, key) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  }
  return map;
}

const lines = [];
lines.push('# 数值模拟回归摘要');
lines.push('');
lines.push(`- 难度：${DIFFICULTY}`);
lines.push(`- 每层增长：${CONFIG.scaling.layer.toFixed(2)}`);
lines.push(`- 模拟：5 主角属性 × 6 队友组合 × 35 关卡 × ${SEEDS} 种子 = ${rows.length} 场`);
lines.push('- 口径：基础队伍，不带藏品 / 关外成长；玩家使用固定贪心策略');
lines.push('');
const totalWins = rows.filter(r => r.win).length;
lines.push(`## 总体`);
lines.push(`- 胜率：${pct(totalWins, rows.length)}（${totalWins}/${rows.length}）`);
lines.push(`- 平均回合：${(rows.reduce((n, r) => n + r.rounds, 0) / rows.length).toFixed(1)}`);
lines.push('');

const byLayer = group(rows, 'layer');
lines.push('## 分层');
lines.push('| 层 | 胜率 | 平均回合 | 平均存活 |');
lines.push('|---:|---:|---:|---:|');
for (const [layer, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
  const wins = list.filter(r => r.win).length;
  lines.push(`| ${layer} | ${pct(wins, list.length)} | ${(list.reduce((n, r) => n + r.rounds, 0) / list.length).toFixed(1)} | ${(list.reduce((n, r) => n + r.playersAlive, 0) / list.length).toFixed(2)} |`);
}
lines.push('');

const byHero = group(rows, 'hero');
lines.push('## 主角属性');
lines.push('| 属性 | 胜率 | 平均回合 |');
lines.push('|---|---:|---:|');
for (const [hero, list] of byHero) {
  const wins = list.filter(r => r.win).length;
  lines.push(`| ${hero} | ${pct(wins, list.length)} | ${(list.reduce((n, r) => n + r.rounds, 0) / list.length).toFixed(1)} |`);
}
lines.push('');

const byPair = group(rows, 'pairs');
lines.push('## 队友组合');
lines.push('| 组合 | 胜率 | 平均回合 |');
lines.push('|---|---:|---:|');
for (const [pair, list] of byPair) {
  const wins = list.filter(r => r.win).length;
  lines.push(`| ${pair} | ${pct(wins, list.length)} | ${(list.reduce((n, r) => n + r.rounds, 0) / list.length).toFixed(1)} |`);
}
lines.push('');

const bossRows = rows.filter(r => r.boss);
lines.push('## BOSS 关卡');
if (bossRows.length) {
  lines.push('| 关卡 | 胜率 | 平均回合 |');
  lines.push('|---|---:|---:|');
  for (const [file, list] of group(bossRows, 'file')) {
    const wins = list.filter(r => r.win).length;
    lines.push(`| ${file} | ${pct(wins, list.length)} | ${(list.reduce((n, r) => n + r.rounds, 0) / list.length).toFixed(1)} |`);
  }
} else {
  lines.push('- 未找到 BOSS 关卡数据');
}
lines.push('');

const byBossHero = bossRows.filter(r => r.boss);
if (byBossHero.length) {
  lines.push('## BOSS × 主角属性');
  lines.push('| 属性 | 胜率 |');
  lines.push('|---|---:|');
  for (const [hero, list] of group(byBossHero, 'hero')) {
    lines.push(`| ${hero} | ${pct(list.filter(r => r.win).length, list.length)} |`);
  }
  lines.push('');
}

const header = ['layer', 'file', 'boss', 'hero', 'pairs', 'seed', 'win', 'draw', 'rounds', 'playersAlive', 'enemiesAlive', 'playerHp'];
const csv = [header.join(',')].concat(rows.map(r => header.map(k => String(r[k] ?? '')).join(','))).join('\n');
const stem = OUT_TAG ? `balance_${OUT_TAG}` : 'balance';
fs.writeFileSync(path.join(OUT_DIR, `${stem}_results.csv`), '\ufeff' + csv, 'utf8');
fs.writeFileSync(path.join(OUT_DIR, `${stem}_summary.md`), lines.join('\n') + '\n', 'utf8');
console.log(lines.join('\n'));
console.log(`\n输出：${path.join(OUT_DIR, `${stem}_results.csv`)}`);
console.log(`输出：${path.join(OUT_DIR, `${stem}_summary.md`)}`);
