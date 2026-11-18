#!/usr/bin/env node
/**
 * Run the eval against a prompt variant (and optionally the live
 * provider), then print the pass^3 report for that run.
 *
 *   node evals/run-variant.mjs v2            → prompts/v2.md, mock
 *   node evals/run-variant.mjs broken        → prompts/broken.md, mock
 *   node evals/run-variant.mjs v1 --live     → prompts/v1.md, live provider
 *
 * The gate defaults to 90% pass^3 for v1/v2 and 0% for broken — the
 * broken variant is EXPECTED to fail; its report is the evidence that
 * the gate would catch it (run summarize.mjs on its output at 0.9 to
 * see the gate itself fail).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const name = process.argv[2];
if (!name) {
  console.error('usage: node evals/run-variant.mjs <prompt-name> [--live]');
  process.exit(2);
}
const live = process.argv.includes('--live');
const gate = name === 'broken' ? '0' : '0.9';
const out = `results/${name}${live ? '-live' : ''}.json`;

mkdirSync('results', { recursive: true });
const env = {
  ...process.env,
  PROMPT_FILE: `prompts/${name}.md`,
  PROMPTFOO_DISABLE_TELEMETRY: '1',
};
if (live) env.PROVIDER = 'live';

function run(command, args, { allowFail = false } = {}) {
  const r = spawnSync(command, args, { stdio: 'inherit', env, shell: true });
  if (r.status !== 0 && !allowFail) process.exit(r.status ?? 1);
}

run('npm', ['run', 'build']);
// Promptfoo exits non-zero when tests fail — that is a result, not an
// infrastructure error. The summarize gate below decides the exit code.
run('npx', [
  'promptfoo', 'eval',
  '-c', 'evals/promptfooconfig.yaml',
  '-o', out,
  '--no-cache',
], { allowFail: true });
if (!existsSync(out)) {
  console.error(`eval did not produce ${out} — treating as an infrastructure failure`);
  process.exit(2);
}
if (!live && name === 'v1') copyFileSync(out, 'results/latest.json');
run('node', ['evals/summarize.mjs', out, gate]);
