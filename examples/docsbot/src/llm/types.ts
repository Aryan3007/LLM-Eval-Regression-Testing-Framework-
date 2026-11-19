export interface EmbedResult {
  vectors: number[][];
  tokens: number;
}

export interface ChatResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/** The only surface DocsBot needs from a model provider; tests swap in a fake. */
export interface LlmProvider {
  embed(texts: string[]): Promise<EmbedResult>;
  chat(input: { system: string; user: string }): Promise<ChatResult>;
}
