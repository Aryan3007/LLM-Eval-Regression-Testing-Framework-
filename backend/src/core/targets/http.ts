import { JSONPath } from 'jsonpath-plus';
import { TargetError } from '../errors.js';
import type { HttpTargetConfig } from '../schemas/suite.js';
import { hashValue } from '../util/hash.js';
import { renderDeep, renderTemplate } from '../util/template.js';
import { computeCost } from './cost.js';
import { type Target, type TargetResult, templateVars } from './types.js';
import { isRetryableStatus } from '../providers/retryable.js';

export function createHttpTarget(config: HttpTargetConfig, hashable: HttpTargetConfig): Target {
  return {
    type: 'http',
    label: config.label ?? defaultLabel(config.url),
    configHash: hashValue(hashable),

    async call(testCase, signal): Promise<TargetResult> {
      const vars = templateVars(testCase);
      const url = renderTemplate(config.url, vars);
      const headers: Record<string, string> = Object.fromEntries(
        Object.entries(config.headers).map(([k, v]) => [k, renderTemplate(v, vars)]),
      );
      const hasBody = config.body !== undefined && config.method !== 'GET';
      if (hasBody) headers['content-type'] ??= 'application/json';

      let res: Response;
      try {
        res = await fetch(url, {
          method: config.method,
          headers,
          ...(hasBody && { body: JSON.stringify(renderDeep(config.body, vars)) }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeout_ms)]),
        });
      } catch (err) {
        if (signal.aborted) throw err;
        const reason =
          err instanceof Error && err.name === 'TimeoutError'
            ? `timed out after ${config.timeout_ms}ms`
            : err instanceof Error
              ? err.cause instanceof Error
                ? err.cause.message
                : err.message
              : String(err);
        throw new TargetError(`${config.method} ${url} failed: ${reason}`, true);
      }

      const text = await res.text();
      if (!res.ok) {
        throw new TargetError(
          `${config.method} ${url} returned ${res.status}: ${text.slice(0, 300)}`,
          isRetryableStatus(res.status),
          res.status,
        );
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new TargetError(`${url} did not return JSON: ${text.slice(0, 200)}`, false);
      }

      const outputs = query(config.output, json);
      const first = outputs[0];
      if (first === undefined || first === null) {
        throw new TargetError(
          `target.output ${config.output} matched nothing in the response`,
          false,
        );
      }
      const inputTokens = config.usage?.input_tokens
        ? toInt(query(config.usage.input_tokens, json)[0])
        : null;
      const outputTokens = config.usage?.output_tokens
        ? toInt(query(config.usage.output_tokens, json)[0])
        : null;

      return {
        output: typeof first === 'string' ? first : JSON.stringify(first),
        context: config.context
          ? query(config.context, json).map((c) => (typeof c === 'string' ? c : JSON.stringify(c)))
          : null,
        inputTokens,
        outputTokens,
        costUsd: computeCost(config.pricing, inputTokens, outputTokens),
      };
    },
  };
}

function query(path: string, json: unknown): unknown[] {
  return JSONPath({ path, json: json as object, wrap: true }) as unknown[];
}

function toInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function defaultLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}
