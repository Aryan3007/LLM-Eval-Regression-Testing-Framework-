import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';

/**
 * A content-addressed JSON cache on disk: `<dir>/<namespace>/<ab>/<hash>.json`.
 * Entries that fail validation are treated as misses, so a schema change never crashes a run.
 */
export class FileCache {
  constructor(private readonly dir: string) {}

  async get<S extends z.ZodType>(
    namespace: string,
    key: string,
    schema: S,
  ): Promise<z.infer<S> | undefined> {
    try {
      const raw = await readFile(this.file(namespace, key), 'utf8');
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : undefined;
    } catch {
      return undefined;
    }
  }

  async set(namespace: string, key: string, value: unknown): Promise<void> {
    const file = this.file(namespace, key);
    await mkdir(path.dirname(file), { recursive: true });
    // Write-then-rename so a crash mid-write never leaves a half-written entry.
    const tmp = `${file}.${String(process.pid)}.tmp`;
    await writeFile(tmp, JSON.stringify(value));
    await rename(tmp, file);
  }

  private file(namespace: string, key: string): string {
    return path.join(this.dir, namespace, key.slice(0, 2), `${key}.json`);
  }
}

/** Stand-in when caching is off. */
export class NoCache extends FileCache {
  constructor() {
    super('');
  }
  override get(): Promise<undefined> {
    return Promise.resolve(undefined);
  }
  override set(): Promise<void> {
    return Promise.resolve();
  }
}
