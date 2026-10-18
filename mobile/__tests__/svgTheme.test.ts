import { darkColors, lightColors } from '@/theme/tokens';
import { inlineClassStyles, replaceCssVars, svgAspectRatio, themeSvg } from '@/utils/svgTheme';

/** Diyagram SVG'lerinin RN SVG için tema renklerine çevrilmesi */
describe('svgTheme', () => {
  it('var(--da-x, #yedek) ifadelerini tema rengine çevirir; bilinmeyen anahtar yedeğe düşer', () => {
    const svg = '<rect fill="var(--da-primary, #6366f1)" stroke="var(--da-unknown, #123456)"/>';
    expect(replaceCssVars(svg, darkColors)).toBe(
      `<rect fill="${darkColors.primary}" stroke="#123456"/>`,
    );
  });

  it('<style> sınıf kurallarını elemanlara öznitelik olarak işler, mevcut öznitelikleri ezmez', () => {
    const svg =
      '<svg><style>.t { fill: red; font-size: 11px; } .k { font-weight: 600; }</style><text class="t k" x="1">a</text><text class="t" fill="blue">b</text></svg>';
    const out = inlineClassStyles(svg);
    expect(out).toContain('<text x="1" fill="red" font-size="11" font-weight="600">a</text>');
    expect(out).toContain('<text fill="blue" font-size="11">b</text>');
  });

  it('title/desc/style ve font-family="inherit" temizlenir', () => {
    const svg =
      '<svg viewBox="0 0 900 420" font-family="inherit" role="img"><title>T</title><desc>D</desc><style>.a{fill:var(--da-fg, #000)}</style><rect class="a"/></svg>';
    const out = themeSvg(svg, lightColors);
    expect(out).toBe(`<svg viewBox="0 0 900 420"><rect fill="${lightColors.fg}"/></svg>`);
    expect(svgAspectRatio(svg)).toBeCloseTo(900 / 420);
  });
});
