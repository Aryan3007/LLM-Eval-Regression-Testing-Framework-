/**
 * Turns FastAPI's mkdocs markdown into plain markdown worth embedding:
 * - inlines `{!> ../../../docs_src/x.py!}` code includes,
 * - keeps only the first tab of each tab group (the others repeat the same example for
 *   older Python versions and would flood retrieval with near-duplicates),
 * - turns `/// info` admonitions into bold labels,
 * - strips HTML tags outside code fences and `hl_lines` fence attributes.
 */
export function preprocessMarkdown(
  markdown: string,
  readInclude: (docsSrcPath: string) => string | undefined,
): string {
  const out: string[] = [];
  let inFence = false;
  let inTab = false;
  let skippingTab = false;
  let lastTabClosedAt = -1;

  const lines = markdown.split('\n');
  for (const [i, raw] of lines.entries()) {
    const line = raw.trimEnd();

    if (!inFence && line.startsWith('//// tab |')) {
      const onlyBlankSinceLastTab =
        lastTabClosedAt >= 0 && lines.slice(lastTabClosedAt + 1, i).every((l) => !l.trim());
      inTab = true;
      skippingTab = onlyBlankSinceLastTab;
      continue;
    }
    if (!inFence && inTab && line === '////') {
      inTab = false;
      skippingTab = false;
      lastTabClosedAt = i;
      continue;
    }
    if (skippingTab) continue;

    const fence = /^(\s*)```/.exec(line);
    if (fence) {
      inFence = !inFence;
      out.push(line.replace(/\s+hl_lines="[^"]*"/, '').replace(/^(\s*)```Python/, '$1```python'));
      continue;
    }

    if (inFence) {
      const include = /^\s*\{!>?\s*([^!]+?)\s*!\}\s*$/.exec(line);
      if (include?.[1]) {
        const target = include[1];
        const start = target.indexOf('docs_src/');
        const code = start >= 0 ? readInclude(target.slice(start)) : undefined;
        if (code !== undefined) out.push(code.trimEnd());
        continue;
      }
      out.push(line);
      continue;
    }

    const admonition = /^\/\/\/\s*(\w+)(?:\s*\|\s*(.+))?$/.exec(line);
    if (admonition?.[1]) {
      const label = admonition[2] ?? admonition[1].charAt(0).toUpperCase() + admonition[1].slice(1);
      out.push(`**${label}:**`);
      continue;
    }
    if (line === '///') continue;

    out.push(line.replace(/<[^>]+>/g, ''));
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
