/* ---- deployment test ---- */
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS: ' + msg);
  else { failed += 1; console.error('FAIL: ' + msg); }
}

run.active = true;
run.difficulty = 5;
run.heroAttr = 4;
run.companions = [COMPANION_MAP.shen, COMPANION_MAP.chi];
run.rogue = new RogueRun(5, 0);
run.stageIndex = 0;
run.path = [run.rogue.options([])[0]];
run.artifacts = [];
run.grantedLayers = [];
const testLevel = {
  name: '测试关卡',
  type: '大平面',
  cells: cells.map(c => (c.region >= 0 ? REGION_ATTR[c.region] : null)),
  enemies: [
    { template: 1, attr: 3, hp: 7, atk: 1, def: 2, sta: 2, mana: 2, atkRange: 2, cell: spawnCell(3).id },
    { template: 1, attr: 4, hp: 7, atk: 1, def: 2, sta: 2, mana: 2, atkRange: 2, cell: spawnCell(4).id },
  ],
};
createPlayerUnits();
enterBattle(testLevel);
closeModal();
startDeployment();

assert(state.phase === 'deploy', 'phase is deploy after fortune');
assert(!!deployment && deployment.order.length === 3, 'deployment has 3 party members');
assert(deployment.index === 0, 'deployment starts at first member');

const defaultIds = deployment.order.map(u => deployment.defaults.get(u.id));
assert(new Set(defaultIds).size === 3, 'default cells are distinct');
assert(deployment.order.every(u => u.cell.id === deployment.defaults.get(u.id)), 'units start on their default cells');
assert(deployment.order.every(u => !enemyOnCell(u.cell)), 'defaults avoid enemy cells');
assert(deployment.order[0].attr === 4, 'hero attr is 4 (collides with enemy2 spawn)');
const listEl = spBody.children.find(el => el.className === 'deploy-list');
assert(!!listEl && listEl.children.length === 3, 'deploy panel lists 3 party members');
assert(confirmBtn.textContent === '开始战斗' && confirmBtn.disabled === true, 'start button disabled before placement');

const u0 = deployment.order[0];
const target = cells.find(c => !cellOccupiedByUnit(c, u0));
placeCurrent(target);
assert(u0.cell.id === target.id, 'placing moves the current unit');
assert(deployment.index === 1, 'index advances after placement');

const u1 = deployment.order[1];
const idxBefore = deployment.index;
placeCurrent(target);
assert(deployment.index === idxBefore, 'occupied cell is rejected');

selectDeployUnit(u0);
assert(deployUnit() === u0, 'clicking a party row re-selects that unit');

resetDeployment();
assert(deployment.index === 0, 'reset returns to first member');
assert(deployment.order.every(u => u.cell.id === deployment.defaults.get(u.id)), 'reset restores default cells');

const chosen = [];
for (const u of deployment.order) {
  const c = cells.find(c => !cellOccupiedByUnit(c, u));
  chosen.push(c.id);
  placeCurrent(c);
}
assert(deployReady(), 'deploy is ready after all members placed');
assert(confirmBtn.disabled === false, 'start button enabled after all placed');
assert(new Set(deployment.order.map(u => u.cell.id)).size === 3, 'chosen cells are distinct');
assert(state.phase === 'deploy', 'still in deploy before confirm');

finishDeployment();
assert(state.phase === 'decision', 'battle starts after confirm');
assert(deployment === null, 'deployment cleared after confirm');
assert(state.round === 1, 'round 1 begins');

run.heroAttr = 0;
run.companions = [COMPANION_MAP.shen, COMPANION_MAP.nian];
createPlayerUnits();
resetGame();
closeModal();
startDeployment();
const dupIds = deployment.order.map(u => deployment.defaults.get(u.id));
assert(new Set(dupIds).size === 3, 'duplicate attrs resolve to distinct defaults');

const foe = units.find(u => u.camp === 1);
for (const u of deployment.order) {
  const c = cells
    .filter(c => !cellOccupiedByUnit(c, u))
    .sort((a, b) => stepDist(a, foe.cell) - stepDist(b, foe.cell))[0];
  placeCurrent(c);
}
finishDeployment();
playerUnits.forEach(u => { u.atk = 99; u.atkRange = 9; });
let guard = 0;
while (!state.over && guard++ < 200) {
  if (state.phase === 'decision') {
    const actor = currentActor();
    const foes = units.filter(u => u.alive && u.camp === 1);
    if (!actor || !foes.length) break;
    const target = foes.sort((a, b) => stepDist(actor.cell, a.cell) - stepDist(actor.cell, b.cell))[0];
    commit({ skillId: 0, targetUnitId: target.id });
  } else {
    await sleep(60);
  }
}
assert(state.over && state.winner === 0, 'battle resolves to victory after deployment');

console.log(failed ? `DONE with ${failed} failure(s)` : 'DONE all pass');
process.exit(failed ? 1 : 0);
