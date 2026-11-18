#!/usr/bin/env node
/**
 * Append one eval run's scores to results/history.json — the trend is
 * data, not memory.
 *
 *   node evals/record-history.mjs results/v1.json mock v1
 *   node evals/record-history.mjs results/v1-live.json live v1
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [file, provider, prompt] = process.argv.slice(2);
if (!file || !provider || !prompt) {
  console.error('usage: node evals/record-history.mjs <results.json> <provider> <prompt>');
  process.exit(2);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const rows = data?.results?.results ?? [];
const byTask = new Map();
for (const row of rows) {
  const name = row.testCase?.description ?? row.vars?.question ?? '(unnamed)';
  if (!byTask.has(name)) byTask.set(name, { trials: 0, passes: 0 });
  const t = byTask.get(name);
  t.trials += 1;
  if (row.success) t.passes += 1;
}
const tasks = byTask.size;
const pass3Tasks = [...byTask.values()].filter((t) => t.passes === t.trials).length;
const totalTrials = [...byTask.values()].reduce((s, t) => s + t.trials, 0);
const totalPasses = [...byTask.values()].reduce((s, t) => s + t.passes, 0);

const entry = {
  date: new Date().toISOString(),
  provider,
  prompt,
  tasks,
  pass3Tasks,
  pass3Rate: tasks ? Number((pass3Tasks / tasks).toFixed(3)) : 0,
  trialPassRate: totalTrials ? Number((totalPasses / totalTrials).toFixed(3)) : 0,
};

const historyFile = 'results/history.json';
const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, 'utf8')) : [];
history.push(entry);
writeFileSync(historyFile, `${JSON.stringify(history, null, 2)}\n`);
console.log('recorded:', JSON.stringify(entry));
