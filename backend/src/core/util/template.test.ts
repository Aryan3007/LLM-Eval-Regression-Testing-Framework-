import { describe, expect, it } from 'vitest';
import { TemplateError } from '../errors.js';
import { renderDeep, renderTemplate } from './template.js';

describe('renderTemplate', () => {
  const vars = { input: 'hi "there"', metadata: { lang: 'en', n: 2 } };

  it('fills variables, including dotted paths', () => {
    expect(renderTemplate('Q: {{ input }} ({{metadata.lang}})', vars)).toBe('Q: hi "there" (en)');
  });

  it('throws on an unknown variable instead of rendering blank', () => {
    expect(() => renderTemplate('{{ expected }}', vars)).toThrow(TemplateError);
  });

  it('renders inside JSON bodies without breaking escaping', () => {
    const body = renderDeep({ question: '{{ input }}', opts: ['{{ metadata.n }}'] }, vars);
    expect(JSON.parse(JSON.stringify(body))).toEqual({ question: 'hi "there"', opts: ['2'] });
  });
});
