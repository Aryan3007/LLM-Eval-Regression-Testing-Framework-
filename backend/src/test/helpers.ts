import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Provider, ProviderFactory } from '../core/providers/index.js';

export async function tempDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'llmeval-test-'));
}

/** Write files (relative path → content) under a fresh temp dir and return it. */
export async function writeTree(files: Record<string, string>): Promise<string> {
  const dir = await tempDir();
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return dir;
}

export const jsonl = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

export interface StubServer {
  url: string;
  hits: () => number;
  maxInFlight: () => number;
  close: () => Promise<void>;
}

/** A tiny HTTP server standing in for the app under test. */
export async function startStub(
  handler: (
    body: Record<string, unknown>,
    hit: number,
  ) => { status?: number; json?: unknown; delayMs?: number },
): Promise<StubServer> {
  let hits = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      hits++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const reply = handler(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}, hits);
      setTimeout(() => {
        inFlight--;
        res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(reply.json ?? {}));
      }, reply.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    hits: () => hits,
    maxInFlight: () => maxInFlight,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** A judge that returns a fixed verdict and counts calls. */
export function fakeJudge(
  score = 5,
  reasoning = 'Looks right.',
): { providers: ProviderFactory; calls: () => number } {
  let calls = 0;
  const provider: Provider = {
    name: 'fake',
    chat: () => {
      calls++;
      return Promise.resolve({
        text: JSON.stringify({ reasoning, score }),
        model: 'fake-judge',
        inputTokens: 100,
        outputTokens: 20,
      });
    },
  };
  return { providers: () => provider, calls: () => calls };
}
