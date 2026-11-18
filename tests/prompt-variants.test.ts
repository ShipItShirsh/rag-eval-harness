import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { parsePromptConfig, DEFAULT_PROMPT_CONFIG } from '../src/prompt-config.js';
import { createApp } from '../src/app.js';

const promptPath = (name: string): string =>
  fileURLToPath(new URL(`../prompts/${name}`, import.meta.url));

test('parsePromptConfig reads the header; defaults when absent', () => {
  assert.deepEqual(parsePromptConfig('no header here'), DEFAULT_PROMPT_CONFIG);
  const cfg = parsePromptConfig(
    '<!--\nprompt-config:\n  citations: off\n  retrievalDepth: 1\n-->\n\n# Prompt',
  );
  assert.deepEqual(cfg, { citations: 'off', retrievalDepth: 1 });
});

test('v1 and v2 keep citations on at depth 4; broken turns both down', async () => {
  const v1 = await createApp({ promptPath: promptPath('v1.md') });
  assert.deepEqual(v1.promptConfig, { citations: 'required', retrievalDepth: 4 });
  const v2 = await createApp({ promptPath: promptPath('v2.md') });
  assert.deepEqual(v2.promptConfig, { citations: 'required', retrievalDepth: 4 });
  const broken = await createApp({ promptPath: promptPath('broken.md') });
  assert.deepEqual(broken.promptConfig, { citations: 'off', retrievalDepth: 1 });
});

test('broken prompt: answers lose their citations', async () => {
  const app = await createApp({ promptPath: promptPath('broken.md') });
  const res = await app.ask('What is the refund policy?');
  assert.deepEqual(res.citations, []);
  assert.ok(!res.answer.includes('[refunds]'), 'answer text must not carry citation markers');
});

test('broken prompt: retrieval depth 1 still answers from the top chunk only', async () => {
  const app = await createApp({ promptPath: promptPath('broken.md') });
  const res = await app.ask('What is the refund policy?');
  assert.ok(res.retrieved.length <= 1);
});
