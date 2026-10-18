import type { ThemeColors } from '@/theme/tokens';

/**
 * İÇERİK SVG'LERİNİ RN SVG İÇİN HAZIRLAMA
 * ---------------------------------------
 * Ders diyagramları (content/**.svg) web'de CSS değişkenleriyle temalanır:
 *   fill="var(--da-primary, #6366f1)"
 * react-native-svg CSS değişkenlerini, <style> bloklarını ve sınıf seçicilerini desteklemez. Bu modül:
 *   1) var(--da-x, #yedek) → aktif tema rengi (anahtar bilinmiyorsa yedek renk)
 *   2) <style> içindeki basit `.sinif { ... }` kurallarını ilgili elemanlara öznitelik olarak işler
 *   3) <title>, <desc>, <style> ve font-family="inherit" gibi desteklenmeyen parçaları temizler
 */

const VAR_RE = /var\(\s*--da-([a-z]+)\s*(?:,\s*([^)]+?)\s*)?\)/g;

export function replaceCssVars(svg: string, colors: ThemeColors): string {
  return svg.replace(VAR_RE, (_m, key: string, fallback?: string) => {
    const c = (colors as unknown as Record<string, string | undefined>)[key];
    return c ?? fallback?.trim() ?? '#888888';
  });
}

/** CSS özelliği → SVG özniteliği (desteklenen alt küme) */
const CSS_TO_ATTR: Record<string, string> = {
  fill: 'fill',
  stroke: 'stroke',
  'stroke-width': 'stroke-width',
  'stroke-dasharray': 'stroke-dasharray',
  'font-size': 'font-size',
  'font-weight': 'font-weight',
  'font-style': 'font-style',
  opacity: 'opacity',
  'fill-opacity': 'fill-opacity',
  'stroke-opacity': 'stroke-opacity',
  'text-anchor': 'text-anchor',
};

export function parseClassRules(css: string): Record<string, Record<string, string>> {
  const rules: Record<string, Record<string, string>> = {};
  const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const decls: Record<string, string> = {};
    for (const part of m[2].split(';')) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const prop = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim().replace(/px$/, '');
      const attr = CSS_TO_ATTR[prop];
      if (attr && value) decls[attr] = value;
    }
    rules[m[1]] = { ...(rules[m[1]] ?? {}), ...decls };
  }
  return rules;
}

export function inlineClassStyles(svg: string): string {
  const styleBlocks = [...svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  if (!styleBlocks) return svg;
  const rules = parseClassRules(styleBlocks);
  return svg.replace(/<([a-zA-Z]+)([^<>]*?)\sclass="([^"]+)"([^<>]*?)(\/?)>/g, (_m, tag: string, before: string, classes: string, after: string, selfClose: string) => {
    const existing = `${before} ${after}`;
    const attrs: Record<string, string> = {};
    for (const cls of classes.split(/\s+/)) Object.assign(attrs, rules[cls] ?? {});
    const extra = Object.entries(attrs)
      .filter(([k]) => !new RegExp(`\\s${k}=`).test(existing))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    return `<${tag}${before}${after}${extra}${selfClose}>`;
  });
}

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/g, '')
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/\sfont-family="inherit"/g, '')
    .replace(/\saria-[a-z]+="[^"]*"/g, '')
    .replace(/\srole="[^"]*"/g, '');
}

/** Tüm adımlar: değişkenleri çöz → sınıfları satır içine al → temizle */
export function themeSvg(svg: string, colors: ThemeColors): string {
  return sanitizeSvg(inlineClassStyles(replaceCssVars(svg, colors)));
}

/** viewBox'tan en-boy oranı (genişlik / yükseklik) */
export function svgAspectRatio(svg: string): number {
  const m = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return 16 / 9;
}
