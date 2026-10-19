/* ---- enemy template test ---- */
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS: ' + msg);
  else { failed += 1; console.error('FAIL: ' + msg); }
}

function makeTestLevel(templates) {
  const board = cells.map(c => (c.region >= 0 ? REGION_ATTR[c.region] : null));
  if (templates.includes(5)) {
    return {
      name: '测试BOSS', type: '前后排', cells: board,
      enemies: [{ template: 5, attr: 0, hp: 42, atk: 2, def: 3, sta: 0, mana: 8, atkRange: 2, cell: 1, cells: [1, 2, 3, 41] }],
    };
  }
  const spawnAttrs = [3, 4];
  return {
    name: '测试关卡', type: '大平面', cells: board,
    enemies: templates.map((tplId, k) => ({
      template: tplId,
      attr: spawnAttrs[k] ?? 0,
      hp: 7, atk: 1, def: 2, sta: 2, mana: 2, atkRange: 2,
      cell: spawnCell(spawnAttrs[k] ?? 0).id,
    })),
  };
}

function setupBattle(templates) {
  run.active = true;
  run.difficulty = 5;
  run.heroAttr = 0;
  run.companions = [COMPANION_MAP.nian, COMPANION_MAP.qian];
  run.rogue = new RogueRun(5, 0);
  run.stageIndex = 0;
  run.path = [run.rogue.options([])[0]];
  run.artifacts = [];
  run.grantedLayers = [];
  createPlayerUnits();
  enterBattle(makeTestLevel(templates));
  closeModal();
  startDeployment();
  for (const u of deployment.order) {
    const c = cells.find(c => !cellOccupiedByUnit(c, u));
    placeCurrent(c);
  }
  finishDeployment();
  playerUnits.forEach(u => {
    u.alive = true;
    u.hp = u.maxHp;
    u.sta = u.maxSta;
    u.mana = u.maxMana;
  });
  units.filter(u => u.camp === 1).forEach(u => {
    u.alive = true;
    u.hp = u.maxHp;
    u.sta = u.maxSta;
    u.mana = u.maxMana;
  });
}

function freeCellNear(target, unit, maxD) {
  return cells.find(c => c.id !== target.cell.id && stepDist(c, target.cell) <= maxD && !cellOccupiedByUnit(c, unit));
}

assert(ENEMY_TEMPLATES[1].name === '无特殊', 'template 1 is plain');
assert(ENEMY_TEMPLATES[2].name === '腐蚀', 'template 2 is corrode');
assert(ENEMY_TEMPLATES[3].name === '嘲讽', 'template 3 is taunt');
assert(ENEMY_TEMPLATES[4].name === '变换', 'template 4 is transform');
assert([1, 2, 3, 4].every(i => Object.values(ENEMY_TEMPLATES[i].baseStats).every(v => v === 1)), 'template base stats default to 1');

setupBattle([2, 3]);
let e1 = units.find(u => u.id === 3);
let e2 = units.find(u => u.id === 4);
const [p1, p2, p3] = playerUnits;
assert(e1.templateId === 2 && e1.name.includes('腐蚀者'), 'enemy 1 uses corrode template');
assert(e2.templateId === 3 && e2.name.includes('嘲讽者'), 'enemy 2 uses taunt template');

moveUnit(p1, freeCellNear(e1, p1, 2));
moveUnit(p2, freeCellNear(e1, p2, 2));
moveUnit(p3, freeCellNear(e1, p3, 2));
p1.def = 2; p2.def = 5; p3.def = 3;
e1.mana = 8; e1.sta = 2; e1.atkRange = 2;
let d = npcDecide(e1);
assert(d.action === 'corrode' && d.targetUnitId === p2.id, 'corrode AI targets highest armor');

e1.atkRange = 0;
d = npcDecide(e1);
assert(d.skillId === 16, 'corrode AI moves toward nearest when nobody in range');
e1.mana = 0; e1.sta = 2;
d = npcDecide(e1);
assert(d.skillId === 2, 'corrode AI dodges when out of mana and has stamina');
e1.sta = 0;
d = npcDecide(e1);
assert(d.skillId === 4, 'corrode AI recovers mana when exhausted');
e1.atkRange = 2;

d = npcDecide(e2);
assert(d.action === 'taunt', 'taunt AI always taunts');

state.decisions = {};
e1.mana = 8;
p1.hp = 20; p1.def = 2; p1.sta = 8;
runCorrode(e1, { targetUnitId: p1.id });
assert(e1.mana === 6 && p1.def === 1 && p1.hp === 20, 'corrode removes 1 armor without damage');
runCorrode(e1, { targetUnitId: p1.id });
assert(e1.mana === 4 && p1.def === 0 && p1.hp === 20, 'corrode removes the last armor without damage');
const cRaw = Math.max(0, e1.atk + modifierParts(e1, p1).m);
runCorrode(e1, { targetUnitId: p1.id });
assert(e1.mana === 2 && p1.hp === 20 - cRaw && p1.sta === 7, 'corrode at zero armor deals damage and -1 stamina');
p1.battleSnapshot = { atk: p1.atk, def: 2, maxDef: 2, maxSta: p1.maxSta, maxMana: p1.maxMana };
restoreBattleStats();
assert(p1.def === 2, 'corrosion armor loss is restored from the pre-battle snapshot');

const tf = new Unit(90, '测试变换', 1, 0, cells[0], BASIC_SKILLS.slice(), { hp: 10, atk: 1, def: 1, sta: 2, mana: 8, atkRange: 2 }, 4);
units.push(tf);
moveUnit(tf, freeCellNear(p1, tf, 2));
moveUnit(p1, freeCellNear(tf, p1, 1));
moveUnit(p2, freeCellNear(tf, p2, 1));
moveUnit(p3, freeCellNear(tf, p3, 1));
p1.attr = 1; p2.attr = 2; p3.attr = 2;
tf.mana = 8; tf.sta = 2; tf.atkRange = 2;
d = npcDecide(tf);
assert(d.action === 'transform' && d.targetUnitId === p1.id, 'transform AI prefers countered target');
tf.mana = 1;
d = npcDecide(tf);
assert(d.skillId === 0, 'transform AI uses normal attack without enough mana');
tf.atkRange = 0; tf.mana = 1;
d = npcDecide(tf);
assert(d.skillId === 16, 'transform AI moves when nobody in range');
tf.mana = 0; tf.sta = 2;
d = npcDecide(tf);
assert(d.skillId === 2, 'transform AI dodges without mana');
tf.sta = 0;
d = npcDecide(tf);
assert(d.skillId === 4, 'transform AI recovers when out of stamina and mana');
tf.atkRange = 2;

state.decisions = {};
const tCell = freeCellNear(p1, tf, 1);
moveUnit(tf, tCell);
setCellAttr(tf.cell, 4);
setCellAttr(p1.cell, 0);
tf.attr = 0; p1.attr = 1;
tf.mana = 8; p1.hp = 20; p1.def = 0; p1.sta = 8;
runTransform(tf, { targetUnitId: p1.id });
assert(tf.cell.attr === 0 && p1.cell.attr === 1, 'transform converts both cells before damage');
assert(tf.mana === 6 && p1.hp === 17, 'transform costs 2 mana and deals 3 damage with both counters');

p1.sta = 8;
state.decisions = { [p1.id]: { skillId: 2 } };
const tfAttr = tf.cell.attr;
const p1Attr = p1.cell.attr;
const p1Hp = p1.hp;
runTransform(tf, { targetUnitId: p1.id });
assert(tf.cell.attr === tfAttr && p1.cell.attr === p1Attr && p1.hp === p1Hp, 'dodged transform converts nothing and deals no damage');

units.splice(units.indexOf(tf), 1);
moveUnit(e1, freeCellNear(p1, e1, 2));
moveUnit(e2, freeCellNear(p1, e2, 2));
e2.taunt = true;
e2.def = 1; e2.hp = 20; e2.tauntUsed = false;
e1.def = 0; e1.hp = 20;
state.decisions = { [e2.id]: { action: 'taunt' } };
p1.atk = 5; p1.atkRange = 9;
const tauntList = validTargets(p1, SKILL_MAP[0]);
assert(tauntList.length === 1 && tauntList[0] === e2, 'taunt limits player attack targets');

const m1 = modifierParts(p1, e2).m;
const raw1 = Math.max(0, 5 + m1);
runAttack(p1, { targetUnitId: e1.id }, SKILL_MAP[0]);
assert(e1.hp === 20, 'taunt retargets an attack aimed at another enemy');
assert(e2.hp === 20 - Math.max(0, raw1 - 2), 'taunt armor +1 applies before the first hit');
assert(e2.def === 1 && e2.tauntUsed === true, 'taunt armor is consumed by defense');

p2.atk = 5; p2.atkRange = 9;
const m2 = modifierParts(p2, e2).m;
const raw2 = Math.max(0, 5 + m2);
runAttack(p2, { targetUnitId: e2.id }, SKILL_MAP[0]);
assert(e2.hp === 20 - Math.max(0, raw1 - 2) - Math.max(0, raw2 - 1), 'taunt armor bonus only triggers once per round');
assert(e2.def === 0, 'taunt defense consumes armor normally');

setupBattle([2, 4]);
const ac1 = units.find(u => u.id === 3);
const ac2 = units.find(u => u.id === 4);
const aq = playerUnits[0];
ac1.mana = 8; ac1.atkRange = 9;
ac2.mana = 8; ac2.atkRange = 9;
aq.def = 2; aq.hp = 20;
state.decisions = {};
playerUnits.forEach(u => { if (u.alive) state.decisions[u.id] = { skillId: 1 }; });
state.decisions[ac1.id] = { action: 'corrode', targetUnitId: aq.id };
state.decisions[ac2.id] = { action: 'transform', targetUnitId: aq.id };
await resolveRound();
assert(ac1.mana === 6, 'resolveRound executes corrode action');
assert(ac2.mana === 6, 'resolveRound executes transform action');
assert(state.round === 2, 'round advances after enemy actions');

setupBattle([3, 4]);
playerUnits.forEach(u => { u.atk = 99; u.atkRange = 9; u.hp = u.maxHp; });
let fguard = 0;
while (!state.over && fguard++ < 100) {
  if (state.phase === 'decision') {
    const actor = currentActor();
    const foes = units.filter(u => u.alive && u.camp === 1);
    if (!actor || !foes.length) break;
    commit({ skillId: 0, targetUnitId: foes[0].id });
  } else {
    await sleep(60);
  }
}
assert(state.over && state.winner === 0, 'full battle with taunt and transform resolves');

setupBattle([1, 1]);
const op = playerUnits[0];
const oe = units.find(u => u.camp === 1);
moveUnit(op, freeCellNear(oe, op, 1));
state.decisions = {};
op.atk = 7; op.mana = 9; op.attr = 0;
oe.attr = 1; oe.def = 0; oe.hp = 40; oe.sta = 8;
setCellAttr(op.cell, 0);
setCellAttr(oe.cell, 4);
const m6 = modifierParts(op, oe).m;
const hp6 = oe.hp;
runAttack(op, { targetUnitId: oe.id }, SKILL_MAP[6]);
assert(SKILL_MAP[6].params.power === 'atk', 'attack1 uses attack power');
assert(op.mana === 7, 'attack1 costs 2 mana');
assert(oe.hp === hp6 - Math.max(0, 7 + m6), 'attack1 damage is attack + modifiers');
assert(oe.cell.attr === 0, 'attack1 converts the target cell');

oe.hp = 40; oe.def = 0; oe.sta = 8;
setCellAttr(oe.cell, 4);
oe.cell.neighbors.forEach(id => setCellAttr(cells[id], 4));
op.mana = 6;
const m7 = modifierParts(op, oe).m;
const hp7 = oe.hp;
runAttack(op, { targetUnitId: oe.id }, SKILL_MAP[7]);
assert(SKILL_MAP[7].params.power === 'atk' && SKILL_MAP[7].cost.mana === 4, 'attack2 uses attack power and costs 4 mana');
assert(op.mana === 2 && oe.hp === hp7 - Math.max(0, 7 + m7), 'attack2 damage is attack + modifiers');
assert(oe.cell.neighbors.every(id => cells[id].attr === 0), 'attack2 converts surrounding cells');
assert(!SKILL_MAP[12].desc.includes('普通攻击'), 'spell1 description affects all attacks');

oe.sta = 8; oe.def = 0; oe.hp = 40;
const oeAttr = oe.cell.attr;
const oeHp = oe.hp;
state.decisions = { [oe.id]: { skillId: 2 } };
op.mana = 8;
runAttack(op, { targetUnitId: oe.id }, SKILL_MAP[6]);
assert(oe.hp === oeHp, 'dodged attack deals no damage');
assert(oe.cell.attr === oeAttr, 'dodged attack does not convert the target cell');

function freeCellNearCell(cell, unit, maxD) {
  return cells.find(c => c.id !== cell.id && stepDist(c, cell) <= maxD && !cellOccupiedByUnit(c, unit));
}
function placeNearBoss(unit, maxD = 2) {
  for (const part of boss.cells) {
    const c = freeCellNearCell(part, unit, maxD);
    if (c) { moveUnit(unit, c); return c; }
  }
  return null;
}
function bossMods(target) {
  return modifierParts(boss, target, bossClosestCell(boss, target.cell), target.cell);
}
function playerPartMods(player, partCell) {
  return modifierParts(player, boss, player.cell, partCell);
}
function playerClosestMods(player) {
  return playerPartMods(player, bossClosestCell(boss, player.cell));
}

setupBattle([5, 1]);
const boss = units.find(u => u.isBoss);
assert(!!boss && boss.templateId === 5, 'boss template spawns a boss');
assert(boss.cells.length === 4 && boss.bossParts.length === 4, 'boss occupies four parts');
assert(new Set(boss.cells.map(c => c.id)).size === 4, 'boss parts are distinct');
const bossCellIds = new Set(boss.cells.map(c => c.id));
assert(boss.cells.every(c => c.neighbors.filter(id => bossCellIds.has(id)).length >= 2), 'boss parts form a connected diamond');
assert(boss.maxHp > 0 && boss.sta === 0, 'boss has positive hp and no stamina');
assert(boss.mana === 8 && boss.atk === 2 && boss.def === 3, 'boss base stats are scaled for difficulty 5 layer 1');
const [bp1, bp2, bp3] = playerUnits;
placeNearBoss(bp1); placeNearBoss(bp2); placeNearBoss(bp3);

for (const part of boss.bossParts) { part.hit = false; part.pending = false; }
boss.hp = boss.maxHp; boss.mana = 8; boss.def = 0; boss.atk = 5;
state.decisions = {};
bp1.atk = 5; bp1.mana = 8; bp1.hp = 30;
const part0 = boss.cells[0];
const part0Before = boss.hp;
runAttack(bp1, { targetUnitId: boss.id, targetPartCellId: part0.id }, SKILL_MAP[0]);
const part0AfterHit = boss.hp;
const part0State = boss.bossParts.find(p => p.cell.id === part0.id);
assert(part0State.pending === true, 'first hit marks a boss part pending');
assert(part0AfterHit < part0Before, 'normal attack damages boss shared hp');
bossEndRound(boss);
assert(boss.hp === part0AfterHit - Math.ceil(boss.maxHp / 8), 'boss action settlement applies 1/8 max hp for the first hit part');
assert(part0State.pending === false && part0State.hit === true, 'part is consumed after settlement');

const settledHp = boss.hp;
runAttack(bp1, { targetUnitId: boss.id, targetPartCellId: part0.id }, SKILL_MAP[0]);
bossEndRound(boss);
assert(boss.hp === settledHp - Math.max(0, 5 + playerPartMods(bp1, part0).m), 're-hitting the same part does not trigger the 1/8 loss again');

const enrageBase = boss.baseAtk;
boss.enraged = false;
boss.hp = Math.floor(boss.maxHp / 2) - 1;
bossEndRound(boss);
assert(boss.enraged && boss.atk === Math.ceil(enrageBase * 1.5), 'boss enrages below half hp with +50% attack');

for (const part of boss.bossParts) { part.hit = false; part.pending = false; }
boss.hp = boss.maxHp; boss.atk = 5; boss.def = 0; boss.mana = 8;
state.decisions = {};
bp1.hp = 30; bp1.def = 0; bp1.mana = 8;
bp2.hp = 30; bp2.def = 0; bp2.mana = 8;
const whipM1 = Math.max(0, 5 + bossMods(bp1).m);
const whipM2 = Math.max(0, 5 + bossMods(bp2).m);
runBossWhip(boss, { targetUnitIds: [bp1.id, bp2.id] });
assert(boss.mana === 6, 'whip costs 2 mana');
assert(bp1.hp === 30 - whipM1 && bp2.hp === 30 - whipM2, 'whip hits two selected players for attack + modifiers');

boss.mana = 8; boss.atk = 5; boss.def = 0;
bp1.hp = 30; bp1.def = 10; bp1.mana = 8;
state.decisions = { [bp1.id]: { skillId: 1 } };
const pierceM = Math.max(0, 5 + bossMods(bp1).m);
runBossPierce(boss, { targetUnitId: bp1.id });
assert(boss.mana === 6 && bp1.hp === 30 - pierceM, 'pierce ignores the target defense');
assert(bp1.def === 9, 'pierce still consumes one defense from the defending target');

for (const part of boss.bossParts) { part.hit = false; part.pending = false; }
boss.hp = boss.maxHp; boss.mana = 4; boss.def = 3; boss.atk = 2;
bp1.hp = 30; bp1.def = 0; bp1.mana = 8; bp1.atk = 5;
state.decisions = { [boss.id]: { action: 'counter' } };
const counterM = Math.max(0, 5 + playerClosestMods(bp1).m);
const bossCellBefore = boss.cell.id;
runAttack(bp1, { targetUnitId: boss.id }, SKILL_MAP[0]);
assert(boss.hp === boss.maxHp - Math.max(0, counterM - 3), 'counter uses normal defense reduction');
assert(bp1.hp === 29, 'counter reflects 1 fixed damage');
assert(boss.mana === 5, 'counter recovers 1 mana');
assert(boss.cell.id === bossCellBefore, 'boss is not knocked back');

boss.mana = 8; bp1.hp = 20; bp1.def = 0; bp1.status = new UnitStatus();
state.decisions = {};
runBossSuppress(boss, { targetUnitId: bp1.id });
assert(boss.mana === 6 && bp1.hp === 19, 'suppress deals 1 fixed damage for 2 mana');
assert(bp1.status.key === 'weak' && bp1.status.turns === 1, 'suppress applies weak for 1 round');

boss.mana = 8; boss.attr = 3;
cells.forEach(c => setCellAttr(c, 0));
runBossBurst(boss);
assert(boss.mana === 6 && cells.every(c => c.attr === 3), 'burst converts all cells to the boss attribute');

bp1.mana = 5; bp2.mana = 0; bp3.mana = 3; boss.mana = 0; boss.maxMana = 8;
runBossDrain(boss);
assert(bp1.mana === 4 && bp2.mana === 0 && bp3.mana === 2, 'drain takes 1 mana from each living enemy');
assert(boss.mana === 2, 'drain recovers the total drained mana');

boss.mana = 3; boss.maxMana = 8;
assert(npcDecideBoss(boss).action === 'drain', 'boss ai drains below half mana');
boss.mana = 8; boss.atkRange = 2; placeNearBoss(bp1);
const bossRangeAct = npcDecideBoss(boss).action;
assert(bossRangeAct === 'whip' || bossRangeAct === 'pierce', 'boss ai attacks when players are in range');
boss.atkRange = 0;
const bossNoRangeAct = npcDecideBoss(boss).action;
assert(['counter', 'suppress', 'burst'].includes(bossNoRangeAct), 'boss ai uses counter/suppress/burst without range');
boss.atkRange = 2;

setupBattle([5, 1]);
const ib = units.find(u => u.isBoss);
const ip = playerUnits[0];
for (const part of ib.cells) {
  const c = freeCellNearCell(part, ip, 2);
  if (c) { moveUnit(ip, c); break; }
}
for (const part of ib.bossParts) { part.hit = false; part.pending = false; }
ib.hp = ib.maxHp; ib.def = 0; ib.atk = 2; ib.mana = 8;
ip.atk = 5; ip.mana = 8; ip.hp = 30;
state.decisions = {};
playerUnits.forEach((u, i) => {
  state.decisions[u.id] = i === 0
    ? { skillId: 0, targetUnitId: ib.id, targetPartCellId: ib.cells[0].id }
    : { skillId: 1 };
});
state.decisions[ib.id] = { action: 'counter' };
const ibRaw = Math.max(0, 5 + modifierParts(ip, ib, ip.cell, ib.cells[0]).m);
await resolveRound();
const ibPart = ib.bossParts.find(p => p.cell.id === ib.cells[0].id);
assert(ibPart.hit && !ibPart.pending, 'resolveRound settles the boss part after the boss action');
assert(ib.hp === ib.maxHp - ibRaw - Math.ceil(ib.maxHp / 8), 'resolveRound applies part loss after boss action');

setupBattle([5, 1]);
const fb = units.find(u => u.isBoss);
playerUnits.forEach(u => { u.atk = 99; u.atkRange = 9; u.hp = u.maxHp; });
let fbg = 0;
while (!state.over && fbg++ < 80) {
  if (state.phase === 'decision') {
    const actor = currentActor();
    if (!actor || !fb.alive) break;
    commit({ skillId: 0, targetUnitId: fb.id });
  } else {
    await sleep(60);
  }
}
assert(state.over && state.winner === 0, 'full boss battle resolves');

setupBattle([1, 1]);
const rewardP = playerUnits[0];
const maxHp0 = new Map(playerUnits.map(u => [u.id, u.maxHp]));
growPartyMaxHp(2);
assert(playerUnits.every(u => u.maxHp === maxHp0.get(u.id) + 2 && u.permMaxHp === 2), 'rest-style max hp growth is permanent');

playerUnits.forEach(u => { u.hp = 1; });
ARTIFACTS.b1.use();
assert(playerUnits.every(u => u.hp === Math.min(u.maxHp, 3)), 'b1 heals the whole party for 2');

const mana0 = rewardP.maxMana;
ARTIFACTS.b2.onGain();
assert(rewardP.maxMana === mana0 + 3 && rewardP.permMaxMana === 3, 'b2 hero max mana +3');

const sta0 = new Map(playerUnits.map(u => [u.id, u.maxSta]));
ARTIFACTS.b3.onGain();
assert(playerUnits.every(u => u.maxSta === sta0.get(u.id) + 2 && u.permMaxSta === 2), 'b3 whole party max stamina +2');

const foe2 = units.find(u => u.camp === 1);
foe2.hp = 20;
ARTIFACTS.b4.use(foe2);
assert(foe2.hp === 17, 'b4 deals 3 fixed damage');

const atk0 = rewardP.atk;
const permAtk0 = rewardP.permAtk;
ARTIFACTS.ganjiang.onGain();
assert(rewardP.atk === atk0 + 2 && rewardP.permAtk === permAtk0 + 2, 'ganjiang permanent atk +2');
const sta1 = rewardP.maxSta;
const mana1 = rewardP.maxMana;
const permSta0 = rewardP.permMaxSta;
const permMana0 = rewardP.permMaxMana;
ARTIFACTS.moye.onGain();
assert(rewardP.maxSta === sta1 + 2 && rewardP.maxMana === mana1 + 2, 'moye permanent max sta/mana +2');
assert(rewardP.permMaxSta === permSta0 + 2 && rewardP.permMaxMana === permMana0 + 2, 'moye permanent fields');

assert(FORTUNES.map(f => fortuneWeight(f)).join(',') === '11,22,44,18,9', 'luck 40 fortune weights are 11/22/44/18/9');
const badAtk = rewardP.atk;
FORTUNES.find(f => f.key === 'bad').apply();
assert(rewardP.atk === badAtk - 1, 'small bad fortune reduces hero atk by 1');
const allAtk = playerUnits.map(u => u.atk);
FORTUNES.find(f => f.key === 'awful').apply();
assert(playerUnits.every((u, i) => u.atk === allAtk[i] - 1), 'awful fortune reduces all atk by 1');

playerUnits.forEach(u => { u.hp = 1; });
run.artifacts = [{ id: 'taie', count: 1, inApplied: false, outApplied: false }];
state.phase = 'decision';
state.onceUsed = false;
state.currentUnitId = rewardP.id;
useOnceArtifact('taie');
assert(playerUnits.every(u => u.hp === u.maxHp), 'taie full heals the party');
assert(!run.artifacts.some(a => a.id === 'taie'), 'taie is consumed after use');

playerUnits.forEach(u => { u.hp = 1; u.sta = 0; u.mana = 0; });
resetGame(run.battleLevel);
closeModal();
assert(playerUnits.every(u => u.hp === u.maxHp && u.sta === u.maxSta && u.mana === u.maxMana), 'battle refresh refills hp/sta/mana');

growPartyMaxHp(1);
saveRun();
const savedV2 = JSON.parse(localStorage.getItem(SAVE_KEY));
assert(savedV2.v === 4 && savedV2.playerState[0].maxHp === playerUnits[0].maxHp, 'save v4 stores max hp');
assert(savedV2.playerState[0].permMaxHp === playerUnits[0].permMaxHp, 'save v4 stores permanent max hp');

console.log(failed ? `DONE with ${failed} failure(s)` : 'DONE all pass');
process.exit(failed ? 1 : 0);
