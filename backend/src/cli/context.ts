import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** pnpm scripts run in the package dir; INIT_CWD is where the user actually typed the command. */
export const userCwd = process.env.INIT_CWD ?? process.cwd();

/** The nearest ancestor holding `.llmeval/` or `.git/`, so runs and baselines live at the repo root. */
export function findProjectRoot(start: string = userCwd): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, '.llmeval')) || existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

/** Load `.env` from the user's cwd and the project root. Existing env vars always win. */
export function loadDotenv(root: string): void {
  for (const dir of new Set([userCwd, root])) {
    const file = path.join(dir, '.env');
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}
