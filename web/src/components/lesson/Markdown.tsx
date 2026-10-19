'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/** Ders Markdown'ı: GFM tablolar, listeler; başlıklara kimlik eklenir (içindekiler için). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-da', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children: c }) => <h2 id={slugify(nodeText(c))}>{c}</h2>,
          h3: ({ children: c }) => <h3 id={slugify(nodeText(c))}>{c}</h3>,
          a: ({ href, children: c }) => (
            <a
              href={href}
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noreferrer noopener' : undefined}
            >
              {c}
            </a>
          ),
          table: ({ children: c }) => (
            <div className="overflow-x-auto">
              <table>{c}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** React düğümünün düz metni (başlıkta `kod` ya da **vurgu** olsa da "[object Object]" çıkmaz) */
function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) =>
      typeof n === 'string' || typeof n === 'number'
        ? String(n)
        : isValidElement<{ children?: ReactNode }>(n)
          ? nodeText(n.props.children)
          : '',
    )
    .join('');
}

/** Markdown başlık satırının düz metni: `kod`, **vurgu**, [bağlantı](url) işaretleri atılır */
export function markdownHeadingText(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

export function slugify(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
