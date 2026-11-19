import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { x as extract } from 'tar';
import { fromRoot } from '../lib/paths.js';

/** Pinned so the dataset's version-specific questions keep the same answers. */
export const CORPUS = { repo: 'fastapi/fastapi', tag: '0.115.0' } as const;
export const SOURCE_REF = `${CORPUS.repo}@${CORPUS.tag}`;

export const corpusDir = fromRoot('data', `fastapi-${CORPUS.tag}`);
export const docsDir = path.join(corpusDir, 'docs/en/docs');

/** Downloads the docs and the code examples they include. No-op if already present. */
export async function fetchCorpus(): Promise<{ downloaded: boolean }> {
  if (existsSync(docsDir)) return { downloaded: false };

  const url = `https://codeload.github.com/${CORPUS.repo}/tar.gz/refs/tags/${CORPUS.tag}`;
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Corpus download failed: ${String(res.status)} ${url}`);

  const tmpDir = `${corpusDir}.tmp`;
  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });
  await pipeline(
    Readable.fromWeb(res.body),
    extract({
      cwd: tmpDir,
      strip: 1,
      filter: (p) => /^[^/]+\/(docs\/en\/docs\/.*\.md|docs_src\/.*)$/.test(p) || p.endsWith('/'),
    }),
  );
  await rename(tmpDir, corpusDir);
  return { downloaded: true };
}

export async function listDocFiles(): Promise<string[]> {
  const entries = await readdir(docsDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.relative(docsDir, path.join(e.parentPath, e.name)))
    .sort();
}
