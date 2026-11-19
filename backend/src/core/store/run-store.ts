import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigError } from '../errors.js';
import { type Run, runSchema } from '../schemas/run.js';

/** Runs live as one JSON file each in `<dataDir>/runs/<id>.json`. */
export class RunStore {
  private readonly dir: string;

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'runs');
  }

  async save(run: Run): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${run.id}.json`);
    const tmp = `${file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(run, null, 2)}\n`);
    await rename(tmp, file);
    return file;
  }

  /** Run ids, newest first. */
  async list(): Promise<string[]> {
    try {
      const files = await readdir(this.dir);
      return files
        .filter((f) => f.startsWith('run_') && f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }

  /** Load a run by id, or the newest with "latest". */
  async load(idOrLatest: string): Promise<Run> {
    const id = idOrLatest === 'latest' ? (await this.list())[0] : idOrLatest;
    if (!id)
      throw new ConfigError(`No runs found in ${this.dir}. Run \`llmeval run <suite>\` first.`);
    let raw: string;
    try {
      raw = await readFile(path.join(this.dir, `${id}.json`), 'utf8');
    } catch {
      throw new ConfigError(`Run "${id}" not found in ${this.dir}`);
    }
    const parsed = runSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new ConfigError(`Run file ${id}.json is not a valid llmeval run`);
    return parsed.data;
  }
}
