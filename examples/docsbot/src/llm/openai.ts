import OpenAI from 'openai';
import type { ChatResult, EmbedResult, LlmProvider } from './types.js';

interface OpenAiProviderOptions {
  apiKey: string;
  embeddingModel: string;
  chatModel?: string;
  chatTemperature?: number | undefined;
}

/** Works with any OpenAI-compatible API; the SDK reads OPENAI_BASE_URL itself. */
export function createOpenAiProvider(options: OpenAiProviderOptions): LlmProvider {
  const client = new OpenAI({ apiKey: options.apiKey, maxRetries: 3, timeout: 60_000 });

  return {
    async embed(texts): Promise<EmbedResult> {
      const res = await client.embeddings.create({ model: options.embeddingModel, input: texts });
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      return { vectors, tokens: res.usage.prompt_tokens };
    },

    async chat({ system, user }): Promise<ChatResult> {
      if (!options.chatModel) throw new Error('chatModel is not configured');
      const res = await client.chat.completions.create({
        model: options.chatModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(options.chatTemperature !== undefined && { temperature: options.chatTemperature }),
      });
      return {
        text: res.choices[0]?.message.content ?? '',
        model: res.model,
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
      };
    },
  };
}
