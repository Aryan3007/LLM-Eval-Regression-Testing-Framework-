import path from 'node:path';

/** Project root (examples/docsbot), whether running from src/ via tsx or from dist/. */
export const projectRoot = path.resolve(import.meta.dirname, '../..');

export function fromRoot(...segments: string[]): string {
  return path.resolve(projectRoot, ...segments);
}
