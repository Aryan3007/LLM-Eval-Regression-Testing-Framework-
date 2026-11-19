/** Base class for every error llmeval raises on purpose; the CLI prints these without a stack. */
export class LlmevalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The suite file, dataset or environment is wrong. Fix the config, then re-run. */
export class ConfigError extends LlmevalError {}

/** Calling the system under test (or a judge model) failed. */
export class TargetError extends LlmevalError {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/** A scorer can't score this case (e.g. `exact_match` on a case with no `expected`). */
export class ScorerInputError extends LlmevalError {}

/** A `{{ variable }}` in a template doesn't exist for this case. */
export class TemplateError extends LlmevalError {}
