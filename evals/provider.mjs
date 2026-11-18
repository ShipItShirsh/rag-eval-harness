import { fileURLToPath } from 'node:url';
import { createApp } from '../dist/src/app.js';

/**
 * Promptfoo provider: the app under test.
 *
 * Promptfoo sends the rendered prompt (the question); this provider runs
 * it through the real app — retrieval, provider, abstention — and returns
 * the full result as a JSON string so the graders in grade.mjs can check
 * the answer text, the citations, and the latency separately.
 *
 * The app is built once per eval run (npm run build must have produced
 * dist/). Paths are resolved from the repo root, not the process CWD.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
let appPromise;

export default class RagEvalProvider {
  id() {
    return 'rag-eval-harness-app';
  }

  async callApi(prompt) {
    appPromise ??= createApp({
      corpusDir: `${root}corpus`,
      promptPath: process.env.PROMPT_FILE ?? `${root}prompts/v1.md`,
    });
    const app = await appPromise;
    const started = Date.now();
    const result = await app.ask(prompt);
    return {
      output: JSON.stringify({ ...result, latencyMs: Date.now() - started }),
    };
  }
}
