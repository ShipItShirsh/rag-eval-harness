import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const app = await createApp();
const http = express();

http.use(express.json());
http.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));

http.get('/health', (_req, res) => {
  res.json({ ok: true, provider: app.providerName, docs: app.docs.length });
});

http.get('/docs/:id', (req, res) => {
  const doc = app.docs.find((d) => d.id === req.params.id);
  if (!doc) {
    res.status(404).type('text/plain').send('No such document.');
    return;
  }
  res.type('text/plain').send(`# ${doc.title}\n\n${doc.body}\n`);
});

http.post('/api/ask', async (req, res) => {
  const question: unknown = (req.body as { question?: unknown } | undefined)?.question;
  if (typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'body must be { "question": "<non-empty string>" }' });
    return;
  }
  try {
    res.json(await app.ask(question));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
  }
});

const port = Number(process.env['PORT'] ?? 3000);
http.listen(port, () => {
  console.log(`rag-eval-harness app listening on http://localhost:${port} (provider: ${app.providerName}, ${app.docs.length} docs)`);
});
