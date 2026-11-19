import type { Pricing } from '../schemas/suite.js';

export function computeCost(
  pricing: Pricing | undefined,
  inputTokens: number | null,
  outputTokens: number | null,
): number | null {
  if (!pricing || inputTokens === null || outputTokens === null) return null;
  return (
    (inputTokens * pricing.input_per_mtok + outputTokens * pricing.output_per_mtok) / 1_000_000
  );
}
