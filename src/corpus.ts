import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Doc {
  id: string;
  title: string;
  body: string;
}

export interface Chunk {
  /** Stable chunk id, e.g. "refunds#2". */
  id: string;
  docId: string;
  text: string;
}

const CORPUS_DIR = fileURLToPath(new URL('../corpus', import.meta.url));

function parseDoc(raw: string, file: string): Doc {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!match) throw new Error(`corpus file ${file}: missing frontmatter`);
  const [, frontmatter = '', body = ''] = match;
  const fields = new Map<string, string>();
  for (const line of frontmatter.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  const id = fields.get('id');
  const title = fields.get('title');
  if (!id || !title) throw new Error(`corpus file ${file}: frontmatter needs id and title`);
  return { id, title, body: body.trim() };
}

/** Load every corpus doc from corpus/. Fails fast on a malformed file. */
export async function loadCorpus(dir: string = CORPUS_DIR): Promise<Doc[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  const docs: Doc[] = [];
  for (const file of files) {
    docs.push(parseDoc(await readFile(join(dir, file), 'utf8'), file));
  }
  const seen = new Set<string>();
  for (const doc of docs) {
    if (seen.has(doc.id)) throw new Error(`duplicate corpus doc id: ${doc.id}`);
    seen.add(doc.id);
  }
  return docs;
}

/**
 * Split a doc into chunks: one chunk per block of text under a heading
 * (heading line included, so chunk text stays self-describing).
 */
export function chunkDoc(doc: Doc): Chunk[] {
  const raw = doc.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  // A heading-only block is not a chunk: it carries almost no text, and
  // BM25's length normalization would rank it above real content. Attach
  // each heading to the block that follows it.
  const blocks: string[] = [];
  let pendingHeading = '';
  for (const block of raw) {
    if (/^#{1,6}\s[^\n]*$/.test(block)) {
      pendingHeading = pendingHeading ? `${pendingHeading}\n${block}` : block;
      continue;
    }
    blocks.push(pendingHeading ? `${pendingHeading}\n${block}` : block);
    pendingHeading = '';
  }
  if (pendingHeading) blocks.push(pendingHeading);
  return blocks.map((text, i) => ({ id: `${doc.id}#${i + 1}`, docId: doc.id, text }));
}

export function chunkCorpus(docs: Doc[]): Chunk[] {
  return docs.flatMap(chunkDoc);
}
