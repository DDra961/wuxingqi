/* ---- protagonist team (step 6) test ---- */
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS: ' + msg);
  else { failed += 1; console.error('FAIL: ' + msg); }
}

function makeEnemy(attr = 1, cell = cells[2], stats = {}) {
  return new Unit(playerUnits.length, '木桩', 1, attr, cell, BASIC_SKILLS.slice(), {
    hp: 100, atk: 3, def: 0, mana: 10, sta: 5, atkRange: 3, ...stats,
  }, 1);
}

function fresh(heroAttr = 0, compIds = ['shen', 'qian']) {
  run.active = true;
  run.heroAttr = heroAttr;
  run.companions = compIds.map(id => COMPANIONS.find(c => c.id === id)).filter(Boolean);
  createPlayerUnits();
  playerUnits.forEach((u, i) => {
    u.cell = cells[1 + i];
    u.alive = true;
    u.atk = u.baseAtk;
    u.def = u.maxDef = u.baseDef;
    u.maxSta = u.baseMaxSta; u.sta = u.maxSta;
    u.maxMana = u.baseMaxMana; u.mana = u.maxMana;
    u.hp = u.maxHp;
    u.damageImmune = false;
    u.skillCostUses = {};
    u.skillOnceUsed = {};
    u.battleSnapshot = { atk: u.atk, def: u.def, maxDef: u.maxDef, maxSta: u.maxSta, maxMana: u.maxMana };
    u.cell.attr = null;
  });
  const enemy = makeEnemy();
  enemy.cell.attr = null;
  units = [...playerUnits, enemy];
  Object.assign(state, { phase: 'decision', over: false, decisions: {}, onceUsed: false, currentUnitId: playerUnits[0].id });
  const by = Object.fromEntries(playerUnits.map(u => [u.charId, u]));
  return { hero: by.hero, shen: by.shen, qian: by.qian, nian: by.nian, chi: by.chi, enemy };
}

// --- team composition ---
{
  const p = fresh(0);
  const defs = Object.fromEntries(COMPANIONS.map(c => [c.id, c]));
  assert(playerUnits.length === 3, 'party has hero plus two selected companions');
  assert(playerUnits.map(u => u.charId).join(',') === 'hero,shen,qian', 'default selection is hero + shen + qian');
  assert(p.hero.attr === 0 && p.shen.attr === 0 && p.qian.attr === 1, 'selected companion attributes');
  assert(p.hero.maxHp === 12 && p.hero.atk === 3 && p.hero.def === 3 && p.hero.maxMana === 4 && p.hero.maxSta === 4 && p.hero.atkRange === 3, 'hero stats');
  assert(p.shen.maxHp === 15 && p.shen.atk === 3 && p.shen.def === 4 && p.shen.maxMana === 4 && p.shen.maxSta === 4 && p.shen.atkRange === 3, 'shen stats');
  assert(p.qian.maxHp === 10 && p.qian.def === 2 && p.qian.maxMana === 5 && p.qian.maxSta === 3 && p.qian.atkRange === 4, 'qian stats');
  assert(defs.nian.stats.hp === 12 && defs.nian.stats.def === 3 && defs.nian.stats.mana === 4 && defs.nian.stats.sta === 3 && defs.nian.stats.atkRange === 3, 'nian stats');
  assert(defs.chi.stats.hp === 10 && defs.chi.stats.atk === 4 && defs.chi.stats.mana === 6 && defs.chi.stats.sta === 3 && defs.chi.stats.atkRange === 4, 'chi stats');
  assert(BASIC_SKILLS.includes(17), 'everyone gets heal spell in basic list');
  assert(p.shen.skills.includes(24) && p.shen.skills.includes(25), 'shen has taunt-armor and armor spell');
  assert(p.qian.skills.includes(26) && p.qian.skills.includes(27), 'qian has vitality and nature');
  assert(defs.nian.special.includes(28) && defs.nian.special.includes(29), 'nian has light cultivate and tide');
  assert(defs.chi.special.includes(30) && defs.chi.special.includes(31), 'chi has scorch and blast');
  assert(p.hero.skills.includes(18) && p.hero.skills.includes(19), 'gold hero has attribute attack and alchemy');
  assert(!p.hero.skills.includes(20), 'gold hero does not get wood spell');
  const p2 = fresh(0, ['nian', 'chi']);
  assert(p2.nian && p2.chi && playerUnits.length === 3, 'other two companions can be selected');
}

// --- level enemies use ids after the five-player party ---
{
  fresh();
  const board = cells.map(() => null);
  const lvl = { name: 'id??', cells: board, enemies: [
    { template: 1, attr: 0, hp: 7, atk: 1, def: 2, sta: 2, mana: 2, atkRange: 2, cell: 10 },
    { template: 1, attr: 1, hp: 7, atk: 1, def: 2, sta: 2, mana: 2, atkRange: 2, cell: 11 },
  ] };
  const enemies = buildLevelEnemies(lvl, 1);
  assert(enemies[0].id === 3 && enemies[1].id === 4, 'level enemies start after the three-player party');
}

// --- heal spell, including self, cost 1 ---
{
  const p = fresh();
  p.hero.sta = 1;
  runHealStamina(p.hero, { targetUnitId: p.hero.id }, SKILL_MAP[17]);
  assert(p.hero.sta === 2 && p.hero.mana === 3, 'heal self restores 1 stamina and costs 1 mana');
  p.qian.sta = 0;
  runHealStamina(p.hero, { targetUnitId: p.qian.id }, SKILL_MAP[17]);
  assert(p.qian.sta === 1 && p.hero.mana === 2, 'heal ally restores 1 stamina');
}

// --- attribute attack: attribute or grid counter, otherwise zero ---
{
  const p = fresh(0);
  p.hero.atkRange = 20;
  p.hero.atk = 3; p.enemy.def = 0; p.enemy.attr = 1;
  runAttributeAttack(p.hero, { targetUnitId: p.enemy.id }, SKILL_MAP[18]);
  assert(p.hero.mana === 1 && p.enemy.hp === 100 - (9 + 1), 'attribute counter deals 3*atk + counter');
  p.hero.mana = 4; p.enemy.hp = 100; p.enemy.attr = 4;
  p.hero.cell.attr = 0; p.enemy.cell.attr = 1; // gold cell beats wood
  runAttributeAttack(p.hero, { targetUnitId: p.enemy.id }, SKILL_MAP[18]);
  assert(p.enemy.hp === 100 - (9 + 1), 'grid counter alone enables 3*atk damage');
  p.hero.mana = 4; p.enemy.hp = 100; p.enemy.attr = 4;
  p.hero.cell.attr = null; p.enemy.cell.attr = null;
  runAttributeAttack(p.hero, { targetUnitId: p.enemy.id }, SKILL_MAP[18]);
  assert(p.hero.mana === 1 && p.enemy.hp === 100, 'no counter means no damage but cost is paid');
}

// --- alchemy: +1 atk each use, cost 1 then 2, snapshot restore ---
{
  const p = fresh(0);
  runAlchemy(p.hero, {}, SKILL_MAP[19]);
  assert(p.hero.atk === 4 && p.hero.mana === 3, 'alchemy first use costs 1 and gives +1 atk');
  runAlchemy(p.hero, {}, SKILL_MAP[19]);
  assert(p.hero.atk === 5 && p.hero.mana === 1, 'alchemy second use costs 2 and stacks +1 atk');
  assert(skillCost(p.hero, SKILL_MAP[19]).mana === 3, 'alchemy next cost becomes 3');
  restoreBattleStats();
  assert(p.hero.atk === 3, 'alchemy attack returns to snapshot after battle');
}

// --- nourish: full hp/sta, defense to snapshot, cost escalates ---
{
  const p = fresh(1);
  const s = SKILL_MAP[20];
  assert(p.hero.skills.includes(20), 'wood hero has nourish');
  p.hero.hp = 1; p.hero.sta = 1; p.hero.def = 0;
  runNourish(p.hero, {}, s);
  assert(p.hero.hp === 12 && p.hero.sta === 4 && p.hero.def === 3 && p.hero.mana === 1, 'nourish heals, restores stamina/def and costs 3');
  assert(skillCost(p.hero, s).mana === 4, 'nourish next cost becomes 4');
}

// --- surge: drain all mana, equal damage, cost escalates ---
{
  const p = fresh(2);
  const s = SKILL_MAP[21];
  assert(p.hero.skills.includes(21), 'water hero has surge');
  p.enemy.mana = 6; p.enemy.hp = 100;
  runSurge(p.hero, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.mana === 0 && p.enemy.hp === 94 && p.hero.mana === 1, 'surge drains all mana and deals equal damage');
  assert(skillCost(p.hero, s).mana === 4, 'surge next cost becomes 4');
}

// --- blaze: 3*atk damage, 2 mana, cost doubles ---
{
  const p = fresh(3);
  const s = SKILL_MAP[22];
  assert(p.hero.skills.includes(22), 'fire hero has blaze');
  assert(s.type === 'attack' && s.cost.mana === 2, 'blaze is an attack with base cost 2');
  p.hero.atk = 3; p.enemy.def = 0; p.enemy.hp = 100; p.hero.mana = 8;
  runBlaze(p.hero, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 91 && p.hero.mana === 6, 'blaze deals 3*atk and costs 2');
  assert(skillCost(p.hero, s).mana === 4, 'blaze next cost doubles to 4');
  runBlaze(p.hero, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 82 && p.hero.mana === 2, 'blaze second use costs 4');
  assert(skillCost(p.hero, s).mana === 8, 'blaze next cost doubles to 8');
}

// --- armor up: reactive defense, only hero, once per battle ---
{
  const p = fresh(4);
  const s = SKILL_MAP[23];
  assert(p.hero.skills.includes(23), 'earth hero has armor up');
  assert(s.type === 'defend' && !s.cost.mana, 'armor up is a free defend skill');
  state.decisions[p.hero.id] = { skillId: 23 };
  p.hero.hp = 12; p.hero.atk = 3;
  p.enemy.atk = 4;
  resolveAttackDamage(p.enemy, p.hero, { label: '测试攻击', power: 4 });
  assert(p.hero.hp === 12 && p.hero.atk === 5 && p.hero.damageImmune, 'armor up triggers on being attacked: immunity and +2 atk');
  assert(p.hero.skillOnceUsed[23], 'armor up records once-per-battle');
  assert(!p.shen.damageImmune && !p.qian.damageImmune, 'armor up only protects the hero');
  resolveAttackDamage(p.enemy, p.hero, { label: '测试攻击', power: 4 });
  assert(p.hero.hp === 12 && p.hero.atk === 5, 'armor up immunity lasts the round and does not stack attack');
  startRound();
  assert(!p.hero.damageImmune, 'armor up immunity expires next round');
  restoreBattleStats();
  assert(p.hero.atk === 3, 'armor up attack returns to snapshot after battle');
}

// --- attack-type spells need range ---
{
  const p = fresh(0);
  p.hero.mana = 20;
  p.hero.atkRange = 0;
  for (const id of [21, 22, 31]) {
    assert(SKILL_MAP[id].type === 'attack', `skill ${id} is an attack`);
    assert(validTargets(p.hero, SKILL_MAP[id]).length === 0, `skill ${id} has no target out of attack range`);
  }
}

// --- cast armor: team defense +1, restored ---
{
  const p = fresh(0);
  const s = SKILL_MAP[25];
  runCastArmor(p.shen, {}, s);
  assert(playerUnits.every(u => u.def === u.baseDef + 1 && u.maxDef === u.baseDef + 1), 'cast armor grants +1 def/max def to team');
  assert(p.shen.mana === 2, 'cast armor costs 2 mana');
  restoreBattleStats();
  assert(playerUnits.every(u => u.def === u.baseDef && u.maxDef === u.baseDef), 'cast armor is restored after battle');
}

// --- vitality: hit damage/heal; miss prevents heal ---
{
  const p = fresh(0);
  const s = SKILL_MAP[26];
  p.qian.atkRange = 20; p.enemy.def = 0; p.enemy.hp = 100; p.hero.hp = 5;
  p.qian.atk = 3; p.hero.atk = 5;
  runVitality(p.qian, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 99 && p.hero.hp === 6 && p.qian.mana === 3, 'vitality uses caster atk for damage and heal');
  p.hero.hp = 5; p.qian.mana = 5; p.enemy.hp = 100;
  state.decisions[p.enemy.id] = { skillId: 2, targetCellId: 3 };
  p.enemy.sta = 2;
  runVitality(p.qian, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 100 && p.hero.hp === 5, 'vitality heal does not trigger if attack is dodged');
}

// --- nature: converts ally cell and heals floor(atk/2) ---
{
  const p = fresh(0);
  const s = SKILL_MAP[27];
  p.qian.mana = 5; p.hero.hp = 5; p.hero.cell.attr = null;
  p.qian.atk = 3; p.hero.atk = 5;
  runNature(p.qian, { targetUnitId: p.hero.id }, s);
  assert(p.hero.cell.attr === p.hero.attr && p.hero.hp === 6 && p.qian.mana === 2, 'nature converts cell and uses caster atk for heal');
}

// --- light cultivate: damage + mana drain; dodge prevents drain ---
{
  const p = fresh(0, ['nian', 'chi']);
  const s = SKILL_MAP[28];
  p.nian.atkRange = 20; p.nian.atk = 4; p.enemy.def = 0; p.enemy.hp = 100; p.enemy.mana = 5;
  runLightCultivate(p.nian, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 96 && p.enemy.mana === 3 && p.nian.mana === 2, 'light cultivate uses caster atk for damage and mana drain');
  p.nian.mana = 5; p.enemy.mana = 5;
  state.decisions[p.enemy.id] = { skillId: 2, targetCellId: 3 };
  p.enemy.sta = 2;
  runLightCultivate(p.nian, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.mana === 5, 'light cultivate drain does not trigger if dodged');
}

// --- tide: +2 attack this battle, restored ---
{
  const p = fresh(0, ['nian', 'chi']);
  const s = SKILL_MAP[29];
  runTide(p.nian, { targetUnitId: p.chi.id }, s);
  assert(p.chi.atk === 6 && p.nian.mana === 1, 'tide grants +2 atk to ally');
  restoreBattleStats();
  assert(p.chi.atk === 4, 'tide is restored after battle');
}

// --- scorch: damage + extra defense loss, including defended target ---
{
  const p = fresh(0, ['nian', 'chi']);
  const s = SKILL_MAP[30];
  p.chi.atkRange = 20; p.enemy.def = 2; p.enemy.hp = 100;
  runScorch(p.chi, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 96 && p.enemy.def === 1, 'scorch deals attack damage and reduces 1 def');
  p.enemy.def = 2; p.enemy.hp = 100; p.chi.mana = 6;
  state.decisions[p.enemy.id] = { skillId: 1 };
  runScorch(p.chi, { targetUnitId: p.enemy.id }, s);
  assert(p.enemy.hp === 98 && p.enemy.def === 0, 'scorch extra def loss stacks after normal defense');
}

// --- blast: all mana, floor(mana*1.5) fixed damage ---
{
  const p = fresh(0, ['nian', 'chi']);
  const s = SKILL_MAP[31];
  p.chi.mana = 5; p.enemy.hp = 100;
  runBlast(p.chi, { targetUnitId: p.enemy.id }, s);
  assert(p.chi.mana === 0 && p.enemy.hp === 93, 'blast spends all mana and deals floor(mana*1.5)');
}

// --- 御金: taunt + first-hit armor, and boss whip respects taunt ---
{
  const p = fresh(0);
  p.shen.cell = cells[1];
  p.hero.cell = cells[2];
  p.enemy.cell = cells[3];
  state.decisions[p.shen.id] = { skillId: 24 };
  state.decisions[p.hero.id] = { skillId: 1 };
  assert(isTaunting(p.shen), '御金 marks shen as taunting');
  const forced = resolveAttackTarget(p.enemy, { targetUnitId: p.hero.id }, '测试攻击', {});
  assert(forced === p.shen, 'taunt forces enemy attack onto shen');
  p.shen.def = 4;
  resolveAttackDamage(p.enemy, p.shen, { label: '测试攻击', power: 3 });
  assert(p.shen.def === 4, '?? first hit grants +1 armor then normal defense -1');

  p.enemy.mana = 10; p.enemy.atkRange = 10; p.enemy.atk = 8;
  p.shen.hp = 15; p.hero.hp = 12; p.qian.hp = 10;
  runBossWhip(p.enemy, { targetUnitIds: [p.hero.id, p.qian.id] });
  assert(p.hero.hp === 12 && p.qian.hp === 10 && p.shen.hp < 15, 'boss whip is forced onto the taunter');
}

// --- luck affects fortune weights and settlement highlight ---
{
  fresh(0);
  run.rogue = new RogueRun(5, 0);
  run.rogue.luck = 40;
  const weights40 = Object.fromEntries(FORTUNES.map(f => [f.key, fortuneWeight(f)]));
  assert(weights40.great === 11 && weights40.good === 22 && weights40.small === 44 && weights40.bad === 18 && weights40.awful === 9, 'luck 40 changes fortune weights');
  run.rogue.luck = 35;
  const weights35 = Object.fromEntries(FORTUNES.map(f => [f.key, fortuneWeight(f)]));
  assert(weights35.great === 10 && weights35.good === 20 && weights35.small === 40 && weights35.bad === 20 && weights35.awful === 10, 'luck 35 is the baseline fortune weights');

  run.rogue.luck = 40;
  run.active = true;
  run.path = [];
  run.stageIndex = 0;
  let luckySeed = -1;
  for (let s = 0; s < 500; s++) {
    run.seed = s;
    if (settlementLuckyIndex() >= 0) { luckySeed = s; break; }
  }
  assert(luckySeed >= 0, 'settlement lucky roll can trigger');
  run.seed = luckySeed;
  showSettlement();
  const luckyBtns = modalActions.children.filter(b => b.className.includes('lucky'));
  assert(luckyBtns.length === 1, 'exactly one settlement option is highlighted');
  assert(luckyBtns[0].textContent.includes('（幸运）'), 'highlighted settlement option is labelled');
}

// --- save v3 migration shape ---
{
  const p = fresh(0);
  run.rogue = new RogueRun(5, 0);
  run.stageIndex = 0;
  run.path = [run.rogue.options([])[0]];
  run.seed = 123;
  saveRun();
  const d = JSON.parse(localStorage.getItem('wuxing_run_v1'));
  assert(d.v === 4 && d.playerState.length === 3 && d.playerState.every(s => s.charId), 'save v4 stores three character states');
  const old = { ...d, v: 2, playerState: d.playerState.slice(0, 3).map(({ charId, ...s }) => s), companions: ['shen', 'qian'] };
  localStorage.setItem('wuxing_run_v1', JSON.stringify(old));
  restoreRun();
  assert(playerUnits.length === 3, 'old v2 save restores the three-player party');
  assert(playerUnits[1].name === '沈桐桐' && playerUnits[2].name === '芊儿', 'old v2 companions map by id');
}

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exitCode = 1;
} else {
  console.log('\nALL PARTY6 TESTS PASSED');
}
