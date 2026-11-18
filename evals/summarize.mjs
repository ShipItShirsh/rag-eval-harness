#!/usr/bin/env node
/**
 * Summarize a Promptfoo results file into the report the project cares
 * about: per task — trials, passes, pass rate, and pass^3 (passed every
 * trial; one lucky run is not a pass) — plus the failure reasons the
 * graders named. Exits non-zero when the pass^3 rate is below the gate.
 *
 * Usage: node evals/summarize.mjs results/latest.json [minPass3Rate]
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'results/latest.json';
const gate = Number(process.argv[3] ?? 0.9);

const data = JSON.parse(readFileSync(file, 'utf8'));
const rows = data?.results?.results;
if (!Array.isArray(rows)) {
  console.error(`No results array in ${file} — did the eval run complete?`);
  process.exit(2);
}

const byTask = new Map();
for (const row of rows) {
  const name = row.testCase?.description ?? row.vars?.question ?? '(unnamed task)';
  if (!byTask.has(name)) byTask.set(name, { trials: 0, passes: 0, reasons: [] });
  const t = byTask.get(name);
  t.trials += 1;
  if (row.success) t.passes += 1;
  else {
    const reason =
      row.gradingResult?.componentResults?.map((c) => c.reason).filter(Boolean).join('; ') ||
      row.error ||
      'failed (no reason recorded)';
    if (!t.reasons.includes(reason)) t.reasons.push(reason);
  }
}

let pass3Tasks = 0;
let totalTrials = 0;
let totalPasses = 0;
console.log(`\nEval report — ${file}`);
console.log('─'.repeat(72));
for (const [name, t] of [...byTask.entries()].sort()) {
  const passAll = t.passes === t.trials;
  if (passAll) pass3Tasks += 1;
  totalTrials += t.trials;
  totalPasses += t.passes;
  const rate = ((t.passes / t.trials) * 100).toFixed(0);
  console.log(
    `${passAll ? 'PASS^3' : 'FAIL  '}  ${name}  (${t.passes}/${t.trials} trials, ${rate}%)`,
  );
  for (const r of t.reasons) console.log(`         ↳ ${r}`);
}
console.log('─'.repeat(72));
const tasks = byTask.size;
const pass3Rate = tasks > 0 ? pass3Tasks / tasks : 0;
console.log(
  `Tasks: ${tasks} · Trials: ${totalTrials} · Trial pass rate: ${((totalPasses / totalTrials) * 100).toFixed(1)}% · ` +
    `pass^3: ${pass3Tasks}/${tasks} (${(pass3Rate * 100).toFixed(1)}%)`,
);
if (pass3Rate < gate) {
  console.log(`GATE: FAIL — pass^3 rate ${(pass3Rate * 100).toFixed(1)}% is below ${(gate * 100).toFixed(0)}%`);
  process.exit(1);
}
console.log(`GATE: PASS — pass^3 rate at or above ${(gate * 100).toFixed(0)}%`);
