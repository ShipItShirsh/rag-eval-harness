import type { Chunk } from './corpus.js';

/**
 * Keyword retrieval with BM25 ranking — the one retrieval method in the
 * MVP. Deterministic: same corpus + same query = same ranking, always.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'can',
  'could', 'i', 'you', 'we', 'it', 'to', 'of', 'in', 'on', 'for', 'with',
  'and', 'or', 'if', 'my', 'your', 'how', 'what', 'when', 'where', 'why',
  'at', 'by', 'from', 'about', 'as', 'be', 'been', 'has', 'have', 'had',
  'will', 'would', 'should', 'this', 'that', 'there', 'than', 'then',
  'into', 'up', 'me', 'am', 'an', 'much', 'many', 'who', 'whom', 'whose',
  // The product's own name appears in nearly every doc; it carries no
  // signal about which doc answers a question.
  'tasknest',
]);

/** Stemming-lite: fold a trailing plural "s" (not "ss") so "passwords"
 *  matches "password". Applied to corpus and queries alike. */
function stem(token: string): string {
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss')
    ? token.slice(0, -1)
    : token;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
}

export class Retriever {
  private readonly chunks: Chunk[];
  private readonly docFreq = new Map<string, number>();
  private readonly termFreq: Map<string, number>[];
  private readonly avgLen: number;

  constructor(chunks: Chunk[]) {
    this.chunks = chunks;
    this.termFreq = chunks.map((c) => {
      const counts = new Map<string, number>();
      for (const term of tokenize(c.text)) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
      return counts;
    });
    for (const counts of this.termFreq) {
      for (const term of counts.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      }
    }
    const total = this.termFreq.reduce(
      (sum, counts) => sum + [...counts.values()].reduce((a, b) => a + b, 0),
      0,
    );
    this.avgLen = chunks.length > 0 ? total / chunks.length : 0;
  }

  /** Rank chunks for a query, best first. Returns at most topK entries. */
  search(query: string, topK: number): ScoredChunk[] {
    const terms = [...new Set(tokenize(query))];
    if (terms.length === 0 || this.chunks.length === 0) return [];
    const n = this.chunks.length;
    const k1 = 1.5;
    const b = 0.75;
    const scored: ScoredChunk[] = [];
    for (let i = 0; i < n; i++) {
      const counts = this.termFreq[i];
      if (!counts) continue;
      const len = [...counts.values()].reduce((a, c) => a + c, 0);
      let score = 0;
      for (const term of terms) {
        const tf = counts.get(term) ?? 0;
        if (tf === 0) continue;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * len) / this.avgLen)));
      }
      if (score > 0) scored.push({ chunk: this.chunks[i] as Chunk, score });
    }
    scored.sort((a, z) => z.score - a.score || a.chunk.id.localeCompare(z.chunk.id));
    return scored.slice(0, topK);
  }
}
