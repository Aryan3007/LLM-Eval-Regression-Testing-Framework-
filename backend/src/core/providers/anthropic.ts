import Anthropic from '@anthropic-ai/sdk';
import { TargetError } from '../errors.js';
import type { ChatRequest, ChatResponse, Provider } from './types.js';
import { isRetryableStatus, statusOf } from './retryable.js';

/**
 * Claude via the official SDK. Credentials resolve the SDK's usual way (ANTHROPIC_API_KEY,
 * ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile). `temperature` is deliberately not
 * sent: the current Messages API version rejects sampling parameters on every model.
 */
export function createAnthropicProvider(): Provider {
  const client = new Anthropic({ maxRetries: 0 });

  return {
    name: 'anthropic',
    async chat(req: ChatRequest): Promise<ChatResponse> {
      let message: Anthropic.Message;
      try {
        message = await client.messages.create(
          {
            model: req.model,
            max_tokens: req.maxTokens,
            ...(req.system && { system: req.system }),
            messages: [{ role: 'user', content: req.prompt }],
          },
          { signal: req.signal },
        );
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionError) {
          throw new TargetError(`anthropic: connection failed: ${err.message}`, true);
        }
        if (err instanceof Anthropic.APIError) {
          const status = statusOf(err);
          throw new TargetError(
            `anthropic: ${status ?? ''} ${err.message}`.trim(),
            isRetryableStatus(status),
            status,
          );
        }
        throw err;
      }

      if (message.stop_reason === 'refusal') {
        const category = message.stop_details?.category ?? 'unspecified';
        throw new TargetError(
          `anthropic: model declined the request (refusal, ${category})`,
          false,
        );
      }

      const text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      return {
        text,
        model: message.model,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    },
  };
}
