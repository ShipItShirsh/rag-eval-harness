import { readdirSync } from 'node:fs';
import { ABSTENTION } from '../dist/src/app.js';

/**
 * The deterministic graders — one Promptfoo javascript assertion used by
 * every task in golden.yaml. Expectations arrive via test vars:
 *
 *   kind:   answerable | strict | abstain
 *   expect: JSON string, e.g.
 *           {"contains":["30-day"],"notContains":["24 hours"],"cite":"refunds"}
 *           {"contains":["JSON"],"citeExact":"export-data"}   (strict)
 *           {}                                                  (abstain)
 *
 * `cite` may be an array when two docs genuinely support the same fact —
 * citing any one of them passes. `containsAny` is a list of fact groups;
 * a group passes when at least one of its alternative phrasings appears
 * (the same fact stated differently in different docs).
 *
 * Checks, in order: latency cap; abstention correctness; expected facts
 * present; forbidden facts absent; citation present, valid, and — for
 * strict tasks — exactly the one source doc. Every failure is named in
 * the returned reason; nothing here uses an LLM judge.
 */

const LATENCY_CAP_MS = 2000;

const validDocIds = new Set(
  readdirSync(new URL('../corpus', import.meta.url))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, '')),
);

export default function grade(output, context) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch {
    return { pass: false, score: 0, reason: 'provider output was not JSON' };
  }
  const answer = typeof parsed.answer === 'string' ? parsed.answer : '';
  const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
  const latencyMs = typeof parsed.latencyMs === 'number' ? parsed.latencyMs : 0;

  const vars = context?.vars ?? {};
  const kind = vars.kind;
  let expect = {};
  try {
    expect = JSON.parse(vars.expect ?? '{}');
  } catch {
    return { pass: false, score: 0, reason: 'test expect var was not valid JSON' };
  }

  const failures = [];
  if (latencyMs > LATENCY_CAP_MS) {
    failures.push(`latency ${latencyMs}ms over cap ${LATENCY_CAP_MS}ms`);
  }

  if (kind === 'abstain') {
    if (answer !== ABSTENTION) {
      failures.push('failed abstention: answered a question the corpus does not cover');
    }
    if (citations.length > 0) failures.push('abstention must not cite anything');
  } else {
    const lower = answer.toLowerCase();
    if (answer === ABSTENTION) failures.push('abstained on an answerable question');
    for (const fact of expect.contains ?? []) {
      if (!lower.includes(String(fact).toLowerCase())) {
        failures.push(`missing fact: "${fact}"`);
      }
    }
    for (const fact of expect.notContains ?? []) {
      if (lower.includes(String(fact).toLowerCase())) {
        failures.push(`forbidden fact present: "${fact}"`);
      }
    }
    for (const group of expect.containsAny ?? []) {
      const alternatives = Array.isArray(group) ? group : [group];
      if (!alternatives.some((f) => lower.includes(String(f).toLowerCase()))) {
        failures.push(`missing fact: one of [${alternatives.map((f) => `"${f}"`).join(', ')}]`);
      }
    }
    if (citations.length === 0) failures.push('missing citation');
    for (const c of citations) {
      if (!validDocIds.has(c)) failures.push(`invalid citation: "${c}"`);
    }
    if (expect.cite) {
      const acceptable = Array.isArray(expect.cite) ? expect.cite : [expect.cite];
      if (!acceptable.some((d) => citations.includes(d))) {
        failures.push(`missing citation: expected one of [${acceptable.join(', ')}]`);
      }
    }
    if (
      expect.citeExact &&
      !(citations.length === 1 && citations[0] === expect.citeExact)
    ) {
      failures.push(
        `wrong citation: expected only [${expect.citeExact}], got [${citations.join(', ')}]`,
      );
    }
  }

  return failures.length === 0
    ? { pass: true, score: 1, reason: 'all checks passed' }
    : { pass: false, score: 0, reason: failures.join('; ') };
}
