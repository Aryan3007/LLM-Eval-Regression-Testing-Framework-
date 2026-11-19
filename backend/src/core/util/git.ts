import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Current commit SHA, or null outside a git repo. Recorded on every run for traceability. */
export async function currentGitSha(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['rev-parse', 'HEAD'], { cwd });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
