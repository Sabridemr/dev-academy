'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { LocalizedString } from '@devacademy/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface Variant {
  language: string;
  code: string;
  title?: LocalizedString;
}

const LANGUAGE_LABELS: Record<string, string> = {
  ts: 'TypeScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  py: 'Python',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  bash: 'Bash',
  sh: 'Shell',
  hcl: 'Terraform',
  json: 'JSON',
  kotlin: 'Kotlin',
  rust: 'Rust',
};

// Shiki highlighter'ı bir kez yüklenir (lazy), çift tema (açık/koyu CSS değişkenleri)
let highlighterPromise: Promise<import('shiki').Highlighter> | null = null;
function getHighlighter() {
  highlighterPromise ??= import('shiki').then((m) =>
    m.createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'typescript',
        'javascript',
        'python',
        'java',
        'go',
        'sql',
        'yaml',
        'bash',
        'json',
        'hcl',
        'kotlin',
        'rust',
      ],
    }),
  );
  return highlighterPromise;
}

function normalizeLang(lang: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    yml: 'yaml',
    sh: 'bash',
    shell: 'bash',
    terraform: 'hcl',
  };
  return map[lang] ?? lang;
}

/** Kod bloğu: Shiki ile sözdizimi vurgulama, dil sekmeleri (TS/Python/Java), kopyalama, satır vurgulama. */
export function CodeBlock({
  language,
  code,
  title,
  alternatives = [],
  highlightLines = [],
}: {
  language: string;
  code: string;
  title?: LocalizedString;
  alternatives?: Variant[];
  highlightLines?: number[];
}) {
  const { t, tl } = useI18n();
  const variants: Variant[] = [{ language, code, title }, ...alternatives];
  const [active, setActive] = useState(0);
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const current = variants[active];

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    getHighlighter()
      .then((h) => {
        const lang = normalizeLang(current.language);
        const loaded = h.getLoadedLanguages().includes(lang);
        const out = h.codeToHtml(current.code, {
          lang: loaded ? lang : 'text',
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
          transformers: [
            {
              line(node, line) {
                if (active === 0 && highlightLines.includes(line))
                  this.addClassToHast(node, 'bg-primary/10 -mx-4 px-4 block');
              },
            },
          ],
        });
        if (!cancelled) setHtml(out);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [current.code, current.language, active, highlightLines]);

  const copy = async () => {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-elevated/50 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1" role="tablist">
          {variants.length > 1 ? (
            variants.map((v, i) => (
              <button
                key={`${v.language}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  i === active ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {LANGUAGE_LABELS[v.language] ?? v.language}
              </button>
            ))
          ) : (
            <span className="px-1 text-xs font-medium text-muted">
              {LANGUAGE_LABELS[language] ?? language}
            </span>
          )}
          {title && <span className="ml-2 truncate text-xs text-muted">· {tl(title)}</span>}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:text-fg"
          aria-label={t('lesson.copy')}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t('lesson.copied') : t('lesson.copy')}
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="whitespace-pre">{current.code}</pre>
        )}
      </div>
    </div>
  );
}
