import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_TEMPLATES,
  renderTemplate,
  resolveTemplate,
} from '../src/shared/prompt-templates';

describe('renderTemplate', () => {
  it('substitutes known placeholders', () => {
    const result = renderTemplate('风格要求：{{style}}', { style: '活泼' });
    expect(result).toBe('风格要求：活泼');
  });

  it('substitutes multiple placeholders', () => {
    const result = renderTemplate('{{a}} and {{b}}', { a: '1', b: '2' });
    expect(result).toBe('1 and 2');
  });

  it('preserves unknown placeholders', () => {
    const result = renderTemplate('{{unknown}} stays', { known: 'x' });
    expect(result).toBe('{{unknown}} stays');
  });

  it('tolerates whitespace inside braces', () => {
    const result = renderTemplate('{{ style }}', { style: 'poetic' });
    expect(result).toBe('poetic');
  });
});

describe('resolveTemplate', () => {
  it('returns a non-empty template as-is', () => {
    expect(resolveTemplate('custom', 'default')).toBe('custom');
  });

  it('falls back on undefined', () => {
    expect(resolveTemplate(undefined, 'default')).toBe('default');
  });

  it('falls back on empty string', () => {
    expect(resolveTemplate('', 'default')).toBe('default');
  });

  it('falls back on whitespace-only string', () => {
    expect(resolveTemplate('   ', 'default')).toBe('default');
  });
});

describe('DEFAULT_PROMPT_TEMPLATES', () => {
  it('provides classify, rename, and translate defaults', () => {
    expect(DEFAULT_PROMPT_TEMPLATES.classify).toContain('{{vocabulary}}');
    expect(DEFAULT_PROMPT_TEMPLATES.rename).toContain('自动选择最合适的描述风格');
    expect(DEFAULT_PROMPT_TEMPLATES.translate).toContain('{{input}}');
  });

  it('bakes the naming style into the rename default without a placeholder', () => {
    expect(DEFAULT_PROMPT_TEMPLATES.rename).not.toContain('{{');
  });
});
