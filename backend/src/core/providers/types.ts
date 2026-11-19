export interface ChatRequest {
  model: string;
  system?: string | undefined;
  prompt: string;
  temperature?: number | undefined;
  maxTokens: number;
  signal?: AbortSignal | undefined;
}

export interface ChatResponse {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * The one call llmeval needs from a model API. Implementations throw `TargetError` with
 * `retryable` set, and never retry themselves: the runner owns retries and backoff.
 */
export interface Provider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
