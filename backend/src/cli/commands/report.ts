import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigError, RunStore } from '../../core/index.js';
import { findProjectRoot, userCwd } from '../context.js';
import { formatRun } from '../format.js';

export interface ReportCommandOptions {
  format: string;
  out?: string;
  dataDir?: string;
}

export async function reportCommand(runId: string, opts: ReportCommandOptions): Promise<number> {
  const dataDir = opts.dataDir
    ? path.resolve(userCwd, opts.dataDir)
    : path.join(findProjectRoot(), '.llmeval');
  const run = await new RunStore(dataDir).load(runId);

  let text: string;
  if (opts.format === 'json') text = JSON.stringify(run, null, 2);
  else if (opts.format === 'table') text = formatRun(run);
  else throw new ConfigError(`Unknown --format "${opts.format}" (use table or json)`);

  if (opts.out) await writeFile(path.resolve(userCwd, opts.out), `${text}\n`);
  else process.stdout.write(`${text}\n`);
  return 0;
}
