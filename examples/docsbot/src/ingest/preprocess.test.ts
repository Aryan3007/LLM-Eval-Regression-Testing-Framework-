import { describe, expect, it } from 'vitest';
import { preprocessMarkdown } from './preprocess.js';

const includes: Record<string, string> = {
  'docs_src/body/tutorial001_py310.py': 'class Item(BaseModel):\n    name: str\n',
};
const read = (p: string) => includes[p];

describe('preprocessMarkdown', () => {
  it('inlines docs_src includes and normalises the fence', () => {
    const md = '```Python hl_lines="2"\n{!> ../../../docs_src/body/tutorial001_py310.py!}\n```';
    expect(preprocessMarkdown(md, read)).toBe(
      '```python\nclass Item(BaseModel):\n    name: str\n```',
    );
  });

  it('drops an include it cannot resolve', () => {
    expect(preprocessMarkdown('```Python\n{!> ../../../docs_src/missing.py!}\n```', read)).toBe(
      '```python\n```',
    );
  });

  it('keeps only the first tab of a consecutive tab group', () => {
    const md = [
      '//// tab | Python 3.10+',
      'first',
      '////',
      '',
      '//// tab | Python 3.8+',
      'second',
      '////',
      '',
      'after',
    ].join('\n');
    expect(preprocessMarkdown(md, read)).toBe('first\n\nafter');
  });

  it('keeps the first tab of a later, separate tab group', () => {
    const md = ['//// tab | A', 'one', '////', 'text between', '//// tab | B', 'two', '////'].join(
      '\n',
    );
    expect(preprocessMarkdown(md, read)).toBe('one\ntext between\ntwo');
  });

  it('turns admonitions into labels', () => {
    expect(preprocessMarkdown('/// tip\n\nUse it.\n\n///', read)).toBe('**Tip:**\n\nUse it.');
    expect(preprocessMarkdown('/// note | Technical Details\nx\n///', read)).toBe(
      '**Technical Details:**\nx',
    );
  });

  it('strips HTML outside code fences but not inside', () => {
    const md =
      'Use <a href="https://x" class="external-link">Pydantic</a>.\n```\n<div>keep</div>\n```';
    expect(preprocessMarkdown(md, read)).toBe('Use Pydantic.\n```\n<div>keep</div>\n```');
  });
});
