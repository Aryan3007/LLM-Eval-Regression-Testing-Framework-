import { TemplateError } from '../errors.js';

const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Replace `{{ path.to.value }}` placeholders. Unknown paths throw instead of rendering blank. */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(VARIABLE, (_match, path: string) => {
    const value = path
      .split('.')
      .reduce<unknown>(
        (obj, key) =>
          obj !== null && typeof obj === 'object'
            ? (obj as Record<string, unknown>)[key]
            : undefined,
        vars,
      );
    if (value === undefined || value === null) {
      throw new TemplateError(`Template variable {{ ${path} }} is not set for this case`);
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

/** Render every string inside a JSON-like value, so templated request bodies stay valid JSON. */
export function renderDeep(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === 'string') return renderTemplate(value, vars);
  if (Array.isArray(value)) return value.map((v) => renderDeep(v, vars));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, renderDeep(v, vars)]),
    );
  }
  return value;
}
