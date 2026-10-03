import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// tokens.css must carry every token block defined in docs/UI_DESIGN.md → DESIGN TOKENS.
const css = readFileSync(new URL('../src/theme/tokens.css', import.meta.url), 'utf8');

describe('design tokens', () => {
  it.each([
    ['--bg', '#D9D4C9'],
    ['--panel', '#E9E5DC'],
    ['--led-on', '#FF6A00'],
    ['--lcd-bg', '#1E1F21'],
    ['--r-pad', '9px'],
    ['--s6', '32px'],
    ['--t-fast', '90ms'],
  ])('%s = %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value}`));
  });
});
