import type { ProviderFactory } from '../providers/index.js';
import type { TargetConfig } from '../schemas/suite.js';
import { createHttpTarget } from './http.js';
import { createModelTarget } from './model.js';
import type { Target } from './types.js';

export function createTarget(
  config: TargetConfig,
  hashable: TargetConfig,
  providers: ProviderFactory,
): Target {
  if (config.type === 'http' && hashable.type === 'http') return createHttpTarget(config, hashable);
  if (config.type === 'model' && hashable.type === 'model') {
    return createModelTarget(config, hashable, providers);
  }
  throw new Error('target config and its hashable copy disagree on type');
}

export type { Target, TargetResult } from './types.js';
