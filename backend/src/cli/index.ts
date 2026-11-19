#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import pc from 'picocolors';
import { LlmevalError } from '../core/index.js';
import { initCommand } from './commands/init.js';
import { reportCommand } from './commands/report.js';
import { runCommand } from './commands/run.js';
import { findProjectRoot, loadDotenv, packageVersion } from './context.js';

const positiveInt = (value: string) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError('must be a positive integer');
  return n;
};
const collect = (value: string, previous: string[]) => [...previous, value];

const program = new Command()
  .name('llmeval')
  .description('Regression-first evals and CI gating for LLM apps')
  .version(packageVersion())
  .option(
    '--data-dir <dir>',
    'where runs and the cache are stored (default: <project root>/.llmeval)',
  );

program
  .command('init')
  .description('scaffold an example suite, dataset and rubric')
  .argument('[dir]', 'directory to create suites/ in', '.')
  .action(async (dir: string) => exit(await initCommand(dir)));

program
  .command('run')
  .description('run a suite and print a scores table')
  .argument('<suite>', 'path to the suite YAML')
  .option('-t, --tag <tag>', 'only run cases with this tag (repeatable)', collect, [])
  .option('--repeats <n>', 'samples per case (overrides run.repeats)', positiveInt)
  .option('--concurrency <n>', 'parallel calls (overrides run.concurrency)', positiveInt)
  .option('--no-cache', 'call the target and judge even if a cached response exists')
  .option('--json', 'print the run as JSON instead of a table')
  .option('-o, --out <file>', 'also write the run JSON to this file')
  .action(
    async (
      suite: string,
      opts: {
        tag: string[];
        repeats?: number;
        concurrency?: number;
        cache: boolean;
        json?: boolean;
        out?: string;
      },
    ) => {
      const dataDir = program.opts<{ dataDir?: string }>().dataDir;
      exit(
        await runCommand(suite, {
          tag: opts.tag,
          cache: opts.cache,
          json: opts.json ?? false,
          ...(opts.repeats !== undefined && { repeats: opts.repeats }),
          ...(opts.concurrency !== undefined && { concurrency: opts.concurrency }),
          ...(opts.out !== undefined && { out: opts.out }),
          ...(dataDir !== undefined && { dataDir }),
        }),
      );
    },
  );

program
  .command('report')
  .description('show a saved run')
  .argument('[run]', 'run id, or "latest"', 'latest')
  .option('-f, --format <format>', 'table or json', 'table')
  .option('-o, --out <file>', 'write to a file instead of stdout')
  .action(async (runId: string, opts: { format: string; out?: string }) => {
    const dataDir = program.opts<{ dataDir?: string }>().dataDir;
    exit(
      await reportCommand(runId, {
        format: opts.format,
        ...(opts.out !== undefined && { out: opts.out }),
        ...(dataDir !== undefined && { dataDir }),
      }),
    );
  });

function exit(code: number): never {
  process.exit(code);
}

loadDotenv(findProjectRoot());

try {
  await program.parseAsync();
} catch (err) {
  if (err instanceof LlmevalError) {
    process.stderr.write(`${pc.red('error')} ${err.message}\n`);
  } else {
    process.stderr.write(
      `${pc.red('unexpected error')} ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
  }
  process.exit(2);
}
