import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../lib/build_game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(ROOT, '测试脚本', 'output');
const growths = [0.05, 0.1, 0.15, 0.2];
const results = [];

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const r = {};
    head.forEach((h, i) => { r[h] = cols[i]; });
    r.layer = Number(r.layer);
    r.rounds = Number(r.rounds);
    r.playersAlive = Number(r.playersAlive);
    r.enemiesAlive = Number(r.enemiesAlive);
    r.win = r.win === 'true';
    return r;
  });
}

function stats(rows) {
  const wins = rows.filter(r => r.win).length;
  const timeout = rows.filter(r => !r.win && r.playersAlive > 0 && r.rounds >= 30).length;
  const wipe = rows.filter(r => r.playersAlive === 0).length;
  return {
    n: rows.length,
    wins,
    winRate: rows.length ? (wins / rows.length * 100) : 0,
    timeout,
    timeoutRate: rows.length ? (timeout / rows.length * 100) : 0,
    wipe,
    wipeRate: rows.length ? (wipe / rows.length * 100) : 0,
    avgRounds: rows.length ? rows.reduce((n, r) => n + r.rounds, 0) / rows.length : 0,
    avgPlayers: rows.length ? rows.reduce((n, r) => n + r.playersAlive, 0) / rows.length : 0,
  };
}

function pct(v) { return v.toFixed(1) + '%'; }

for (const growth of growths) {
  const tag = 'g' + String(growth).replace('.', '').padEnd(3, '0');
  console.log(`\n========== 每层增长 ${growth} ==========`);
  const env = { ...process.env, LAYER_GROWTH: String(growth), OUT_TAG: tag };
  const run = spawnSync(process.execPath, [path.join(here, 'run_balance.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env,
  });
  if (run.status !== 0) throw new Error(`growth ${growth} failed`);
  const rows = readCsv(path.join(outDir, `balance_${tag}_results.csv`));
  const layer6 = rows.filter(r => r.layer === 6);
  results.push({ growth, tag, all: stats(rows), layer6: stats(layer6), rows });
}

const lines = [];
lines.push('# 每层增长倍率实验');
lines.push('');
lines.push('## 测试方式');
lines.push('');
lines.push('- 难度 5，5 主角属性 × 6 队友组合 × 35 关卡 × 2 种子；每层增长分别取 0.05 / 0.10 / 0.15 / 0.20');
lines.push('- 基础队伍，不带藏品 / 求签 / 结算 / 关外成长');
lines.push('- 测试站位：二环自己属性节点优先，被占用则逐环外扩、同环按 ID 尝试');
lines.push('- 每层增长只作用于第 1~6 层普通敌人；第 7 层 BOSS 仍只按难度缩放');
lines.push('');
lines.push('## 总体与第 6 层');
lines.push('');
lines.push('| 每层增长 | 总体胜率 | 总体平均回合 | 第6层胜率 | 第6层超时 | 第6层团灭 | 第6层平均回合 |');
lines.push('|---:|---:|---:|---:|---:|---:|---:|');
for (const r of results) {
  lines.push(`| ${r.growth.toFixed(2)} | ${pct(r.all.winRate)} | ${r.all.avgRounds.toFixed(1)} | ${pct(r.layer6.winRate)} | ${pct(r.layer6.timeoutRate)} | ${pct(r.layer6.wipeRate)} | ${r.layer6.avgRounds.toFixed(1)} |`);
}
lines.push('');
lines.push('## 分层胜率');
lines.push('');
lines.push('| 每层增长 | 第1层 | 第2层 | 第3层 | 第4层 | 第5层 | 第6层 | 第7层 BOSS |');
lines.push('|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of results) {
  const cols = [1, 2, 3, 4, 5, 6, 7].map(layer => pct(stats(r.rows.filter(x => x.layer === layer)).winRate));
  lines.push(`| ${r.growth.toFixed(2)} | ${cols.join(' | ')} |`);
}
lines.push('');
lines.push('## 第 6 层各元素胜率');
lines.push('');
lines.push('| 每层增长 | 金 | 木 | 水 | 火 | 土 |');
lines.push('|---:|---:|---:|---:|---:|---:|');
for (const r of results) {
  const cols = ['金', '木', '水', '火', '土'].map(el => {
    const rows = r.rows.filter(x => x.layer === 6 && x.file.includes(`-${el}.json`));
    return pct(stats(rows).winRate);
  });
  lines.push(`| ${r.growth.toFixed(2)} | ${cols.join(' | ')} |`);
}
lines.push('');
lines.push('## 说明');
lines.push('');
lines.push('- 该实验只改变普通敌人的层数成长，不改变 BOSS 的难度缩放。');
lines.push('- 第 6 层是当前基线最明显的断点，因此单独列出胜率、超时率、团灭率和各元素胜率。');
lines.push('- 结果仍受固定贪心策略、基础队伍、2 个种子限制。');

const md = lines.join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'growth_experiment.md'), md, 'utf8');
const csvLines = ['growth,overall_win_rate,overall_avg_rounds,layer6_win_rate,layer6_timeout_rate,layer6_wipe_rate,layer6_avg_rounds'];
for (const r of results) {
  csvLines.push([
    r.growth.toFixed(2),
    r.all.winRate.toFixed(1),
    r.all.avgRounds.toFixed(1),
    r.layer6.winRate.toFixed(1),
    r.layer6.timeoutRate.toFixed(1),
    r.layer6.wipeRate.toFixed(1),
    r.layer6.avgRounds.toFixed(1),
  ].join(','));
}
fs.writeFileSync(path.join(outDir, 'growth_experiment.csv'), csvLines.join('\n') + '\n', 'utf8');
console.log('\n' + md);
console.log(`输出：${path.join(outDir, 'growth_experiment.md')}`);
console.log(`输出：${path.join(outDir, 'growth_experiment.csv')}`);
