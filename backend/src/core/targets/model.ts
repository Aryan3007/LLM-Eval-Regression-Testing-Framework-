import type { ProviderFactory } from '../providers/index.js';
import type { ModelTargetConfig } from '../schemas/suite.js';
import { hashValue } from '../util/hash.js';
import { renderTemplate } from '../util/template.js';
import { computeCost } from './cost.js';
import { type Target, type TargetResult, templateVars } from './types.js';

export function createModelTarget(
  config: ModelTargetConfig,
  hashable: ModelTargetConfig,
  providers: ProviderFactory,
): Target {
  const provider = providers(config.provider);
  return {
    type: 'model',
    label: config.label ?? `${config.provider}:${config.model}`,
    configHash: hashValue(hashable),

    async call(testCase, signal): Promise<TargetResult> {
      const vars = templateVars(testCase);
      const res = await provider.chat({
        model: config.model,
        system: config.system !== undefined ? renderTemplate(config.system, vars) : undefined,
        prompt: renderTemplate(config.prompt, vars),
        temperature: config.temperature,
        maxTokens: config.max_tokens,
        signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeout_ms)]),
      });
      return {
        output: res.text,
        context: null,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        costUsd: computeCost(config.pricing, res.inputTokens, res.outputTokens),
      };
    },
  };
}
