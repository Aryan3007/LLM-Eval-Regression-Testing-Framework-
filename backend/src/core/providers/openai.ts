import OpenAI from 'openai';
import { ConfigError, TargetError } from '../errors.js';
import type { ChatRequest, ChatResponse, Provider } from './types.js';
import { isRetryableStatus, statusOf } from './retryable.js';

interface OpenAiCompatibleOptions {
  name: string;
  apiKeyEnv: string;
  baseURL?: string;
  env: Record<string, string | undefined>;
}

/** OpenAI, and any OpenAI-compatible API (Groq) via `baseURL`. */
export function createOpenAiCompatibleProvider(options: OpenAiCompatibleOptions): Provider {
  const apiKey = options.env[options.apiKeyEnv];
  if (!apiKey) {
    throw new ConfigError(`Provider "${options.name}" needs ${options.apiKeyEnv} to be set`);
  }
  const client = new OpenAI({
    apiKey,
    maxRetries: 0,
    ...(options.baseURL && { baseURL: options.baseURL }),
  });

  return {
    name: options.name,
    async chat(req: ChatRequest): Promise<ChatResponse> {
      try {
        const res = await client.chat.completions.create(
          {
            model: req.model,
            messages: [
              ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
              { role: 'user' as const, content: req.prompt },
            ],
            max_completion_tokens: req.maxTokens,
            ...(req.temperature !== undefined && { temperature: req.temperature }),
          },
          { signal: req.signal },
        );
        return {
          text: res.choices[0]?.message.content ?? '',
          model: res.model,
          inputTokens: res.usage?.prompt_tokens ?? null,
          outputTokens: res.usage?.completion_tokens ?? null,
        };
      } catch (err) {
        throw toTargetError(options.name, err);
      }
    },
  };
}

function toTargetError(provider: string, err: unknown): unknown {
  if (err instanceof OpenAI.APIConnectionError) {
    return new TargetError(`${provider}: connection failed: ${err.message}`, true);
  }
  if (err instanceof OpenAI.APIError) {
    const status = statusOf(err);
    return new TargetError(
      `${provider}: ${status ?? ''} ${err.message}`.trim(),
      isRetryableStatus(status),
      status,
    );
  }
  return err;
}
