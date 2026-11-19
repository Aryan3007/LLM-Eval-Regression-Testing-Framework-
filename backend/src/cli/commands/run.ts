import path from 'node:path';
import pc from 'picocolors';
import { loadSuite, RunStore, runSuite } from '../../core/index.js';
import { findProjectRoot, userCwd } from '../context.js';
import { formatRun } from '../format.js';
import { writeFile } from 'node:fs/promises';

export interface RunCommandOptions {
  tag: string[];
  repeats?: number;
  concurrency?: number;
  cache: boolean;
  json: boolean;
  out?: string;
  dataDir?: string;
}

export async function runCommand(suiteArg: string, opts: RunCommandOptions): Promise<number> {
  const root = findProjectRoot();
  const dataDir = opts.dataDir ? path.resolve(userCwd, opts.dataDir) : path.join(root, '.llmeval');
  const suite = await loadSuite(path.resolve(userCwd, suiteArg), { tags: opts.tag });

  const controller = new AbortController();
  process.once('SIGINT', () => {
    process.stderr.write(pc.yellow('\nStopping after in-flight calls…\n'));
    controller.abort();
  });

  const progress = process.stderr.isTTY && !opts.json;
  const run = await runSuite(suite, {
    dataDir,
    cache: opts.cache,
    tags: opts.tag,
    signal: controller.signal,
    ...(opts.repeats !== undefined && { repeats: opts.repeats }),
    ...(opts.concurrency !== undefined && { concurrency: opts.concurrency }),
    onProgress: (done, total) => {
      if (progress)
        process.stderr.write(`\r${pc.dim(`running ${suite.config.suite}`)} ${done}/${total}`);
    },
  });
  if (progress) process.stderr.write('\r\x1b[2K');

  const savedTo = await new RunStore(dataDir).save(run);
  if (opts.out)
    await writeFile(path.resolve(userCwd, opts.out), `${JSON.stringify(run, null, 2)}\n`);

  if (opts.json) process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
  else process.stdout.write(`${formatRun(run, path.relative(userCwd, savedTo))}\n`);

  // Exit 2 when nothing could be scored at all: a broken target, not a quality signal.
  if (run.status === 'aborted') return 2;
  return run.totals.errors === run.totals.samples ? 2 : 0;
}
