import type { ProviderName } from '../schemas/suite.js';
import { createAnthropicProvider } from './anthropic.js';
import { createOpenAiCompatibleProvider } from './openai.js';
import type { Provider } from './types.js';

export type ProviderFactory = (name: ProviderName) => Provider;

export function createProviderFactory(env: Record<string, string | undefined>): ProviderFactory {
  const cache = new Map<ProviderName, Provider>();
  return (name) => {
    let provider = cache.get(name);
    if (!provider) {
      provider = build(name, env);
      cache.set(name, provider);
    }
    return provider;
  };
}

function build(name: ProviderName, env: Record<string, string | undefined>): Provider {
  switch (name) {
    case 'openai':
      return createOpenAiCompatibleProvider({ name, apiKeyEnv: 'OPENAI_API_KEY', env });
    case 'groq':
      return createOpenAiCompatibleProvider({
        name,
        apiKeyEnv: 'GROQ_API_KEY',
        baseURL: 'https://api.groq.com/openai/v1',
        env,
      });
    case 'anthropic':
      return createAnthropicProvider();
  }
}

export type { ChatRequest, ChatResponse, Provider } from './types.js';
