import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCorpus, chunkCorpus } from '../src/corpus.js';
import { Retriever } from '../src/retrieve.js';
import { createApp, ABSTENTION } from '../src/app.js';

test('corpus loads 20 docs with unique ids', async () => {
  const docs = await loadCorpus();
  assert.equal(docs.length, 20);
  assert.equal(new Set(docs.map((d) => d.id)).size, 20);
  for (const doc of docs) assert.ok(doc.body.length > 100, `${doc.id} body too short`);
});

test('retrieval ranks the pricing doc first for a pricing question', async () => {
  const retriever = new Retriever(chunkCorpus(await loadCorpus()));
  const results = retriever.search('How much does the Pro plan cost per month?', 4);
  assert.ok(results.length > 0);
  assert.equal(results[0]?.chunk.docId, 'plans-and-pricing');
});

test('ask answers an answerable question with a valid citation', async () => {
  const app = await createApp();
  const res = await app.ask('What is the refund policy?');
  assert.ok(res.answer.includes('30-day'), `answer should state the guarantee: ${res.answer}`);
  assert.deepEqual(res.citations, ['refunds']);
  assert.ok(res.retrieved.length > 0);
  assert.ok(res.retrieved[0]?.startsWith('refunds#'), 'top retrieved chunk should be from the refunds doc');
});

test('ask abstains on a question the corpus does not cover', async () => {
  const app = await createApp();
  const res = await app.ask('How do I bake sourdough bread at home?');
  assert.equal(res.answer, ABSTENTION);
  assert.deepEqual(res.citations, []);
  assert.deepEqual(res.retrieved, []);
});

test('mock provider is deterministic: same question, same answer', async () => {
  const app = await createApp();
  const a = await app.ask('How long does a password reset link last?');
  const b = await app.ask('How long does a password reset link last?');
  assert.deepEqual(a, b);
  assert.ok(a.answer.includes('1 hour'));
});

test('ask rejects an empty question', async () => {
  const app = await createApp();
  await assert.rejects(() => app.ask('   '), /must not be empty/);
});
