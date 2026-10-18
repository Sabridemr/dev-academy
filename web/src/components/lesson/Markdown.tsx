'use client';

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
          h2: ({ children: c }) => <h2 id={slugify(String(c))}>{c}</h2>,
          h3: ({ children: c }) => <h3 id={slugify(String(c))}>{c}</h3>,
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
