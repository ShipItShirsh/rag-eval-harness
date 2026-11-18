import type { Chunk } from './corpus.js';
import { tokenize } from './retrieve.js';

export interface ProviderInput {
  question: string;
  systemPrompt: string;
  chunks: Chunk[];
}

export interface ProviderOutput {
  answer: string;
  citations: string[];
}

/**
 * A provider turns a question + retrieved chunks into an answer.
 * The mock is the default; a live provider sits behind the same interface
 * and is enabled only by env var + the runner's own key (Phase 3).
 */
export interface Provider {
  readonly name: string;
  complete(input: ProviderInput): Promise<ProviderOutput>;
}

/** Turn markdown table rows into plain sentences: "Pro: Monthly billing $12, …". */
function tableSentences(lines: string[]): string[] {
  const rows = lines.map((l) =>
    l
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0),
  );
  const [header, ...rest] = rows;
  if (!header || header.length < 2) return [];
  const out: string[] = [];
  for (const row of rest) {
    if (row.every((c) => /^:?-+:?$/.test(c))) continue; // | --- | separator
    const label = row[0];
    if (!label) continue;
    const parts = row
      .slice(1)
      .map((v, i) => `${header[i + 1] ?? ''} ${v}`.trim())
      .filter((p) => p.length > 0);
    if (parts.length > 0) out.push(`${label}: ${parts.join(', ')}.`);
  }
  return out;
}

function splitSentences(text: string): string[] {
  const lines = text.split('\n');
  const table = tableSentences(lines.filter((l) => l.trim().startsWith('|')));
  const prose = lines
    .filter((l) => !l.trim().startsWith('|'))
    .join('\n')
    .replace(/^#.*$/gm, ' ')
    .replace(/\*\*/g, '');
  const sentences = prose
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/^\d+\.\s*/, ''))
    .filter((s) => s.length > 15);
  return [...table, ...sentences];
}

function chunkIndex(chunk: Chunk): number {
  const n = Number(chunk.id.split('#')[1]);
  return Number.isFinite(n) ? n : 0;
}

/** Bonus for sentences carrying a concrete fact (a number, price, duration). */
const FACT_BONUS = 0.75;

/**
 * Deterministic stand-in for an LLM. It composes an answer only from the
 * retrieved chunks:
 *
 * - an anchor: the lead sentence of the primary document's earliest
 *   retrieved chunk (a doc's opening usually states its main fact, and
 *   may not repeat the question's words);
 * - the two best supporting sentences, scored by whole-corpus term
 *   rarity (IDF) plus a bonus for sentences containing a number, with
 *   sentences from other documents penalized — the primary document
 *   should carry its own answer;
 * - the immediate neighbours of those sentences within their chunk,
 *   because a fact and its qualifier often sit in adjacent sentences
 *   ("payments are non-refundable. This includes annual plans…").
 *
 * Same input, same output — which is what lets the deterministic graders
 * run in CI with no API key. It mirrors the v1 prompt's rules (answer
 * from context, cite, be brief); it does not read the prompt text — the
 * live provider does.
 */
export class MockProvider implements Provider {
  readonly name = 'mock';
  private readonly idf: Map<string, number> | undefined;

  /** @param idf whole-corpus inverse document frequency per term, if known. */
  constructor(idf?: Map<string, number>) {
    this.idf = idf;
  }

  async complete(input: ProviderInput): Promise<ProviderOutput> {
    if (input.chunks.length === 0) return { answer: '', citations: [] };
    const queryTerms = new Set(tokenize(input.question));

    // Fallback weights when no corpus IDF was supplied: rarity within the
    // retrieved chunks themselves.
    const chunkFreq = new Map<string, number>();
    for (const chunk of input.chunks) {
      for (const term of new Set(tokenize(chunk.text))) {
        if (queryTerms.has(term)) chunkFreq.set(term, (chunkFreq.get(term) ?? 0) + 1);
      }
    }
    const weight = (term: string): number =>
      this.idf?.get(term) ?? 1 / (chunkFreq.get(term) ?? 1);

    interface Pick {
      sentence: string;
      docId: string;
      score: number;
      chunkIdx: number;
      sentIdx: number;
    }
    const primaryDoc = (input.chunks[0] as Chunk).docId;
    const chunkSentences: string[][] = [];
    const picked: Pick[] = [];
    input.chunks.forEach((chunk, chunkIdx) => {
      const sentences = splitSentences(chunk.text);
      chunkSentences.push(sentences);
      sentences.forEach((sentence, sentIdx) => {
        const matched = [...new Set(tokenize(sentence))].filter((t) => queryTerms.has(t));
        if (matched.length === 0) return;
        let score = matched.reduce((sum, t) => sum + weight(t), 0);
        if (/\d/.test(sentence)) score += FACT_BONUS;
        if (chunk.docId !== primaryDoc) score *= 0.5;
        picked.push({ sentence, docId: chunk.docId, score, chunkIdx, sentIdx });
      });
    });
    picked.sort((a, z) => z.score - a.score || a.chunkIdx - z.chunkIdx || a.sentIdx - z.sentIdx);

    // Anchor: lead sentence of the primary doc's earliest retrieved chunk.
    let anchor: Pick | undefined;
    const primaryChunks = input.chunks
      .filter((c) => c.docId === primaryDoc)
      .sort((a, z) => chunkIndex(a) - chunkIndex(z));
    for (const chunk of primaryChunks) {
      const first = splitSentences(chunk.text)[0];
      if (first) {
        anchor = {
          sentence: first,
          docId: chunk.docId,
          score: Number.POSITIVE_INFINITY,
          chunkIdx: input.chunks.indexOf(chunk),
          sentIdx: 0,
        };
        break;
      }
    }

    // Selection, in priority order: anchor, the two best supporting
    // sentences, then the neighbours of everything selected. Capped at
    // MAX_SENTENCES; output is re-ordered to reading order at the end.
    const MAX_SENTENCES = 6;
    const chosen = new Map<string, Pick>();
    const add = (p: Pick): void => {
      if (chosen.size < MAX_SENTENCES && !chosen.has(p.sentence)) chosen.set(p.sentence, p);
    };
    if (anchor) add(anchor);
    const supporters = picked.filter((p) => !chosen.has(p.sentence)).slice(0, 2);
    for (const p of supporters) add(p);
    const seeds = [...chosen.values()];
    for (const seed of seeds) {
      const sentences = chunkSentences[seed.chunkIdx] ?? [];
      for (const delta of [-1, 1]) {
        const idx = seed.sentIdx + delta;
        const sentence = sentences[idx];
        const chunk = input.chunks[seed.chunkIdx];
        if (sentence && chunk) {
          add({ sentence, docId: chunk.docId, score: 0, chunkIdx: seed.chunkIdx, sentIdx: idx });
        }
      }
    }
    const top = [...chosen.values()].sort(
      (a, z) => a.chunkIdx - z.chunkIdx || a.sentIdx - z.sentIdx,
    );
    if (top.length === 0) return { answer: '', citations: [] };

    const citations = [...new Set(top.map((t) => t.docId))];
    const answer = top.map((t) => `${t.sentence} [${t.docId}]`).join(' ');
    return { answer, citations };
  }
}

/** Whole-corpus IDF weights (same formula as the retriever's). */
export function corpusIdf(chunks: Chunk[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    for (const term of new Set(tokenize(chunk.text))) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const n = chunks.length;
  const idf = new Map<string, number>();
  for (const [term, d] of df) {
    idf.set(term, Math.log(1 + (n - d + 0.5) / (d + 0.5)));
  }
  return idf;
}
