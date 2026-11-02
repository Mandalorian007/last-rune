import { describe, expect, it } from 'vitest';
import { scaledPx, scaleFontSizes, scalePxCss, textScaleTokens, toTextScale } from './text-scale';

describe('text scale', () => {
  it('scales body text fully and big display text only as far as body text', () => {
    expect(scaledPx(24, 1.5)).toBe(36);
    expect(scaledPx(30, 1.5)).toBe(45);
    expect(scaledPx(40, 1.5)).toBe(45);
    expect(scaledPx(56, 1.5)).toBe(56);
    expect(scaledPx(24, 1)).toBe(24);
    expect(scaledPx(84, 1.25)).toBe(84);
  });

  it('CSS lengths follow the variable and agree with scaledPx', () => {
    expect(scalePxCss(20)).toBe('calc(20px * var(--lr-text-scale, 1))');
    expect(scalePxCss(40)).toBe('max(40px, calc(30px * var(--lr-text-scale, 1)))');
    expect(scalePxCss(62)).toBe('62px');
  });

  it('rewrites font-size declarations and the font shorthand', () => {
    const css =
      '.a { font-size: 19px; } .b { font: 400 26px/1.4 system-ui; } .c { font-size: 62px; }';
    const out = scaleFontSizes(css);
    expect(out).toContain('.a { font-size: calc(19px * var(--lr-text-scale, 1)); }');
    expect(out).toContain('.b { font: 400 calc(26px * var(--lr-text-scale, 1))/1.4 system-ui; }');
    expect(out).toContain('.c { font-size: 62px; }');
    // Other lengths are left alone.
    expect(scaleFontSizes('.d { width: 24px; margin: 30px; }')).toBe(
      '.d { width: 24px; margin: 30px; }',
    );
  });

  it('engine font tokens', () => {
    expect(textScaleTokens(1)).toEqual({
      fontSizeS: '24px',
      fontSizeM: '30px',
      fontSizeL: '40px',
      fontSizeXl: '56px',
      fontSizeXxl: '84px',
    });
    expect(textScaleTokens(1.5).fontSizeS).toBe('36px');
    expect(textScaleTokens(1.5).fontSizeL).toBe('45px');
  });

  it('unknown saved values mean 100%', () => {
    expect(toTextScale(125)).toBe(125);
    expect(toTextScale(undefined)).toBe(100);
    expect(toTextScale(110)).toBe(100);
    expect(toTextScale('150')).toBe(100);
  });
});
