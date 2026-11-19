import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';
import { userCwd } from '../context.js';

const FILES: Record<string, string> = {
  'suites/example.yaml': `# llmeval suite. Paths below are relative to this file.
suite: example
description: Starter suite. Point the target at your app, then grow the dataset.

# What gets tested. This calls a model directly. To test your own app over HTTP:
#   target: { type: http, url: http://localhost:8000/ask, body: { question: "{{ input }}" }, output: $.answer }
target:
  type: model
  provider: openai # openai | anthropic | groq
  model: \${LLMEVAL_TARGET_MODEL}
  system: You are a concise, accurate assistant.
  prompt: '{{ input }}'

dataset:
  path: example.jsonl

# The grader for llm_judge scorers. Keep it fixed so scores stay comparable run over run.
judge:
  provider: openai
  model: \${LLMEVAL_JUDGE_MODEL}

run:
  concurrency: 4

scorers:
  - type: llm_judge
    name: correctness
    rubric: rubrics/correctness.md
    pass_at: 0.75
  - type: not_contains
    value: 'As an AI language model'
  - type: length
    max_chars: 1500
`,
  'suites/example.jsonl':
    [
      {
        id: 'http-idempotent',
        input: 'Which HTTP methods are idempotent?',
        expected:
          'GET, HEAD, PUT, DELETE, OPTIONS and TRACE are idempotent; POST and PATCH are not.',
        tags: ['http'],
      },
      {
        id: 'json-vs-jsonl',
        input: 'What is the difference between JSON and JSON Lines?',
        expected:
          'JSON Lines stores one JSON value per line, so files can be streamed and appended; a JSON file holds a single value.',
        tags: ['formats'],
      },
      {
        id: 'git-revert-vs-reset',
        input: 'When should I use git revert instead of git reset?',
        expected:
          'Use git revert on shared history: it adds a new commit that undoes changes. git reset rewrites history and suits local, unpushed commits.',
        tags: ['git'],
      },
    ]
      .map((c) => JSON.stringify(c))
      .join('\n') + '\n',
  'suites/rubrics/correctness.md': `Grade whether the output correctly and completely answers the input.

- Compare facts against the reference answer. Contradicting it is a serious error.
- Missing a key point from the reference lowers the score; extra correct detail does not.
- A vague answer that avoids the question fails, even if nothing in it is false.
`,
};

export async function initCommand(dirArg: string | undefined): Promise<number> {
  const root = path.resolve(userCwd, dirArg ?? '.');
  for (const [rel, content] of Object.entries(FILES)) {
    const file = path.join(root, rel);
    if (existsSync(file)) {
      process.stdout.write(`${pc.yellow('skip')}   ${rel} (already exists)\n`);
      continue;
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
    process.stdout.write(`${pc.green('create')} ${rel}\n`);
  }
  process.stdout.write(
    `\nNext:\n  export OPENAI_API_KEY=… LLMEVAL_TARGET_MODEL=… LLMEVAL_JUDGE_MODEL=…\n  llmeval run ${path.join(path.relative(userCwd, root) || '.', 'suites/example.yaml')}\n`,
  );
  return 0;
}
