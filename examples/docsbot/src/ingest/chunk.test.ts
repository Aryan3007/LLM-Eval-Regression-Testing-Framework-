import { describe, expect, it } from 'vitest';
import { chunkDocument, splitBlocks, splitSections, type Tokenizer } from './chunk.js';

/** One token per whitespace-separated word: easy to reason about in assertions. */
const words: Tokenizer = {
  count: (t) => t.split(/\s+/).filter(Boolean).length,
  split: (t, max) => {
    const ws = t.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < ws.length; i += max) out.push(ws.slice(i, i + max).join(' '));
    return out;
  },
};

describe('splitSections', () => {
  it('tracks the heading trail and ignores # inside code fences', () => {
    const md = '# A\nintro\n## B\n```\n# not a heading\n```\n### C\ndeep\n## D\nlast';
    expect(splitSections(md).map((s) => s.heading)).toEqual(['A', 'A > B', 'A > B > C', 'A > D']);
  });

  it('strips {#anchor} suffixes and backticks from the trail', () => {
    const [section] = splitSections('## Use `Body` { #body }\ntext');
    expect(section?.heading).toBe('Use Body');
    expect(section?.headingLine).toBe('## Use `Body`');
  });
});

describe('splitBlocks', () => {
  it('splits on blank lines but keeps code fences whole', () => {
    expect(splitBlocks('p1\n\n```\na\n\nb\n```\n\np2')).toEqual(['p1', '```\na\n\nb\n```', 'p2']);
  });
});

describe('chunkDocument', () => {
  const para = (n: number, tag: string) =>
    Array.from({ length: n }, (_, i) => `${tag}${String(i)}`).join(' ');

  it('never exceeds chunkSize tokens', () => {
    const md = ['# T', para(30, 'a'), para(30, 'b'), '## U', para(80, 'c'), para(10, 'd')].join(
      '\n\n',
    );
    for (const chunk of chunkDocument(md, { chunkSize: 40, overlap: 10 }, words)) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(40);
      expect(words.count(chunk.content)).toBe(chunk.tokenCount);
    }
  });

  it('packs small sections together when they fit', () => {
    const md = '# T\nalpha\n## U\nbeta\n## V\ngamma';
    const chunks = chunkDocument(md, { chunkSize: 100, overlap: 0 }, words);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('## V');
    expect(chunks[0]?.heading).toBe('T');
  });

  it('carries trailing blocks into the next chunk as overlap', () => {
    const md = [para(8, 'a'), para(4, 'b'), para(8, 'c')].join('\n\n');
    const chunks = chunkDocument(md, { chunkSize: 14, overlap: 5 }, words);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]?.content.startsWith('b0 b1 b2 b3')).toBe(true);
  });

  it('labels a chunk with the heading of its first new block, not the overlap', () => {
    const md = ['# T', para(10, 'a'), '## U', para(10, 'b')].join('\n\n');
    const chunks = chunkDocument(md, { chunkSize: 14, overlap: 0 }, words);
    expect(chunks.map((c) => c.heading)).toEqual(['T', 'T > U']);
  });

  it('keeps a heading glued to the block after it', () => {
    const md = ['# T', para(10, 'a'), '## U', para(10, 'b')].join('\n\n');
    const chunks = chunkDocument(md, { chunkSize: 14, overlap: 0 }, words);
    expect(chunks[0]?.content).not.toContain('## U');
    expect(chunks[1]?.content.startsWith('## U')).toBe(true);
  });
});
