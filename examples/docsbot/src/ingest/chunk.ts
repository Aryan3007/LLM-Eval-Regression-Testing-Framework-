export interface Tokenizer {
  count(text: string): number;
  /** Split text into pieces of at most `maxTokens` tokens each. */
  split(text: string, maxTokens: number): string[];
}

export interface Section {
  /** Heading trail, e.g. "Request Body > Create your data model". */
  heading: string;
  /** The section's own heading line as written, e.g. "## Create your data model". */
  headingLine: string | null;
  text: string;
}

export interface ChunkDraft {
  heading: string;
  content: string;
  tokenCount: number;
}

interface Unit {
  heading: string;
  text: string;
}

/** Split markdown into sections by heading, tracking the heading trail. */
export function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const trail: string[] = [];
  let headingLine: string | null = null;
  let buffer: string[] = [];
  let inFence = false;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text || headingLine) {
      sections.push({ heading: trail.filter(Boolean).join(' > '), headingLine, text });
    }
    buffer = [];
  };

  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    const match = inFence ? null : /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (match?.[1] && match[2]) {
      flush();
      const level = match[1].length;
      const title = match[2].replace(/\s*\{[^}]*\}\s*$/, '');
      trail.length = level - 1;
      trail[level - 1] = title.replace(/`/g, '');
      headingLine = `${match[1]} ${title}`;
      continue;
    }
    buffer.push(line);
  }
  flush();
  return sections;
}

/** Paragraphs and whole code fences: the units we never split unless they're oversized. */
export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (!inFence && !line.trim()) {
      if (current.length) blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join('\n'));
  return blocks;
}

/**
 * Chunk one doc page. Sections are packed together up to `chunkSize` tokens, so chunk size
 * really changes how much unrelated text shares a chunk (the point of planted regression #2).
 * Heading lines stay inline and are glued to the block after them, so no chunk ends on a
 * dangling heading. Each new chunk starts with the trailing blocks of the previous one that
 * fit in `overlap` tokens, so an answer spanning a boundary is still retrievable.
 */
export function chunkDocument(
  markdown: string,
  { chunkSize, overlap }: { chunkSize: number; overlap: number },
  tokenizer: Tokenizer,
): ChunkDraft[] {
  const units: Unit[] = [];
  for (const section of splitSections(markdown)) {
    const blocks = splitBlocks(section.text);
    if (section.headingLine)
      blocks[0] = [section.headingLine, blocks[0]].filter(Boolean).join('\n\n');
    for (const block of blocks) {
      if (!block) continue;
      const pieces =
        tokenizer.count(block) > chunkSize ? tokenizer.split(block, chunkSize) : [block];
      for (const text of pieces) units.push({ heading: section.heading, text });
    }
  }

  const chunks: ChunkDraft[] = [];
  let current: Unit[] = [];
  let carried = 0;
  const join = (us: Unit[]) => us.map((u) => u.text).join('\n\n');

  const emit = () => {
    const first = current[carried];
    if (!first) return;
    const content = join(current);
    chunks.push({ heading: first.heading, content, tokenCount: tokenizer.count(content) });
  };

  for (const unit of units) {
    if (current.length > 0 && tokenizer.count(join([...current, unit])) > chunkSize) {
      emit();
      current = takeOverlap(current, overlap, tokenizer);
      // Joining adds separator tokens, so drop carried units until the new one fits.
      while (current.length && tokenizer.count(join([...current, unit])) > chunkSize) {
        current.shift();
      }
      carried = current.length;
    }
    current.push(unit);
  }
  emit();
  return chunks;
}

function takeOverlap(units: Unit[], overlap: number, tokenizer: Tokenizer): Unit[] {
  const kept: Unit[] = [];
  for (let i = units.length - 1; i >= 0; i--) {
    const unit = units[i];
    if (!unit) break;
    const next = [unit, ...kept];
    if (tokenizer.count(next.map((u) => u.text).join('\n\n')) > overlap) break;
    kept.unshift(unit);
  }
  return kept;
}
