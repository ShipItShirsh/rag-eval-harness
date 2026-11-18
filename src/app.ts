import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCorpus, chunkCorpus, type Doc } from './corpus.js';
import { Retriever, tokenize } from './retrieve.js';
import { MockProvider, LiveProvider, corpusIdf, type Provider } from './provider.js';
import { parsePromptConfig, type PromptConfig } from './prompt-config.js';

/** The fixed abstention reply. Must match the prompt files word for word. */
export const ABSTENTION = "I don't have information about that in the help centre.";

/**
 * Minimum BM25 score for a chunk to count as relevant. Below it, the app
 * abstains instead of answering from a weak match.
 */
export const RELEVANCE_FLOOR = 1.5;

export interface AskResult {
  answer: string;
  citations: string[];
  retrieved: string[];
}

export interface App {
  ask(question: string): Promise<AskResult>;
  docs: Doc[];
  providerName: string;
  promptConfig: PromptConfig;
}

export interface AppOptions {
  provider?: Provider;
  promptPath?: string;
  corpusDir?: string;
}

function defaultProvider(chunks: ReturnType<typeof chunkCorpus>): Provider {
  if (process.env['PROVIDER'] === 'live') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('PROVIDER=live requires OPENAI_API_KEY in the environment');
    }
    return new LiveProvider(apiKey, process.env['LIVE_MODEL'] ?? 'gpt-4o-mini');
  }
  return new MockProvider(corpusIdf(chunks));
}

export async function createApp(options: AppOptions = {}): Promise<App> {
  const docs = await loadCorpus(options.corpusDir);
  const chunks = chunkCorpus(docs);
  const retriever = new Retriever(chunks);
  const provider = options.provider ?? defaultProvider(chunks);
  const promptPath =
    options.promptPath ??
    process.env['PROMPT_FILE'] ??
    fileURLToPath(new URL('../prompts/v1.md', import.meta.url));
  const systemPrompt = await readFile(promptPath, 'utf8');
  const promptConfig = parsePromptConfig(systemPrompt);

  return {
    docs,
    providerName: provider.name,
    promptConfig,
    async ask(question: string): Promise<AskResult> {
      const q = question.trim();
      if (q.length === 0) throw new Error('question must not be empty');
      const relevant = retriever
        .search(q, promptConfig.retrievalDepth)
        .filter((r) => r.score >= RELEVANCE_FLOOR);
      if (relevant.length === 0) {
        return { answer: ABSTENTION, citations: [], retrieved: [] };
      }
      // Coverage gate: a single shared filler word ("home") must not turn
      // an unrelated question into an answer. At least half of the
      // question's content terms must appear in the retrieved chunks.
      const queryTerms = new Set(tokenize(q));
      if (queryTerms.size > 0) {
        const covered = new Set<string>();
        for (const r of relevant) {
          for (const term of tokenize(r.chunk.text)) {
            if (queryTerms.has(term)) covered.add(term);
          }
        }
        if (covered.size / queryTerms.size < 0.5) {
          return { answer: ABSTENTION, citations: [], retrieved: [] };
        }
      }
      const chunks = relevant.map((r) => r.chunk);
      const out = await provider.complete({ question: q, systemPrompt, chunks });
      if (out.answer.length === 0) {
        return { answer: ABSTENTION, citations: [], retrieved: [] };
      }
      return {
        answer: out.answer,
        citations: out.citations,
        retrieved: chunks.map((c) => c.id),
      };
    },
  };
}
