/**
 * BASİT SÖZDİZİMİ VURGULAMA
 * -------------------------
 * Ağır bir bağımlılık yerine küçük bir tokenizer: yorum, metin (string), sayı, anahtar kelime.
 * Ders kod örnekleri için yeterli; dil bilinmiyorsa ortak anahtar kelime kümesi kullanılır.
 */
export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'type';

export interface Token {
  kind: TokenKind;
  text: string;
}

const COMMON = [
  'if',
  'else',
  'for',
  'while',
  'return',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'class',
  'import',
  'from',
  'export',
  'true',
  'false',
  'null',
];

const KEYWORDS: Record<string, string[]> = {
  ts: [
    ...COMMON,
    'const',
    'let',
    'var',
    'function',
    'async',
    'await',
    'interface',
    'type',
    'extends',
    'implements',
    'public',
    'private',
    'protected',
    'readonly',
    'static',
    'of',
    'in',
    'as',
    'undefined',
    'this',
    'super',
    'enum',
    'yield',
    'typeof',
    'keyof',
    'void',
  ],
  py: [
    ...COMMON,
    'def',
    'lambda',
    'None',
    'True',
    'False',
    'elif',
    'pass',
    'with',
    'as',
    'yield',
    'async',
    'await',
    'self',
    'in',
    'is',
    'not',
    'and',
    'or',
    'raise',
    'except',
    'global',
    'nonlocal',
  ],
  java: [
    ...COMMON,
    'public',
    'private',
    'protected',
    'static',
    'final',
    'void',
    'int',
    'long',
    'double',
    'boolean',
    'String',
    'extends',
    'implements',
    'interface',
    'abstract',
    'this',
    'super',
    'synchronized',
    'var',
    'record',
  ],
  go: [
    ...COMMON,
    'func',
    'package',
    'var',
    'const',
    'type',
    'struct',
    'interface',
    'map',
    'chan',
    'go',
    'defer',
    'select',
    'range',
    'nil',
  ],
  sql: [
    'SELECT',
    'FROM',
    'WHERE',
    'INSERT',
    'INTO',
    'VALUES',
    'UPDATE',
    'SET',
    'DELETE',
    'CREATE',
    'TABLE',
    'INDEX',
    'PRIMARY',
    'KEY',
    'FOREIGN',
    'REFERENCES',
    'JOIN',
    'LEFT',
    'RIGHT',
    'INNER',
    'ON',
    'GROUP',
    'BY',
    'ORDER',
    'LIMIT',
    'AND',
    'OR',
    'NOT',
    'NULL',
    'AS',
    'BEGIN',
    'COMMIT',
    'ROLLBACK',
    'UNIQUE',
    'DEFAULT',
    'HAVING',
    'DISTINCT',
    'COUNT',
    'EXPLAIN',
    'TRANSACTION',
    'ISOLATION',
    'LEVEL',
  ],
  sh: [
    'if',
    'then',
    'fi',
    'else',
    'for',
    'do',
    'done',
    'echo',
    'export',
    'case',
    'esac',
    'function',
    'in',
  ],
};

const ALIASES: Record<string, string> = {
  typescript: 'ts',
  javascript: 'ts',
  js: 'ts',
  tsx: 'ts',
  jsx: 'ts',
  python: 'py',
  kotlin: 'java',
  csharp: 'java',
  cs: 'java',
  golang: 'go',
  bash: 'sh',
  shell: 'sh',
  yaml: 'sh',
  yml: 'sh',
  postgres: 'sql',
  postgresql: 'sql',
};

function keywordSet(language: string): Set<string> {
  const key = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  return new Set(KEYWORDS[key] ?? COMMON);
}

function lineCommentPrefix(language: string): string[] {
  const l = ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  if (l === 'py' || l === 'sh') return ['#'];
  if (l === 'sql') return ['--'];
  return ['//'];
}

/** Tek satırı tokenlara böler (çok satırlı yorumlar satır bazında ele alınır) */
export function tokenizeLine(line: string, language: string): Token[] {
  const keywords = keywordSet(language);
  const sqlCaseInsensitive = (ALIASES[language.toLowerCase()] ?? language.toLowerCase()) === 'sql';
  const comments = lineCommentPrefix(language);
  const tokens: Token[] = [];
  let i = 0;
  let plain = '';
  const flush = () => {
    if (plain) tokens.push({ kind: 'plain', text: plain });
    plain = '';
  };
  // Blok yorumun devam satırı (" * açıklama" / " */")
  if (/^\s*\*(\s|\/|$)/.test(line)) return [{ kind: 'comment', text: line }];
  while (i < line.length) {
    const rest = line.slice(i);
    if (comments.some((c) => rest.startsWith(c)) || rest.startsWith('/*')) {
      flush();
      tokens.push({ kind: 'comment', text: rest });
      return tokens;
    }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      flush();
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      tokens.push({ kind: 'string', text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(line[i - 1] ?? '')) {
      flush();
      const m = /^[0-9][0-9_.xXa-fA-F]*/.exec(rest);
      const text = m ? m[0] : ch;
      tokens.push({ kind: 'number', text });
      i += text.length;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(rest);
      const word = m ? m[0] : ch;
      const isKw = keywords.has(word) || (sqlCaseInsensitive && keywords.has(word.toUpperCase()));
      if (isKw) {
        flush();
        tokens.push({ kind: 'keyword', text: word });
      } else if (/^[A-Z][a-z]/.test(word)) {
        flush();
        tokens.push({ kind: 'type', text: word });
      } else {
        plain += word;
      }
      i += word.length;
      continue;
    }
    plain += ch;
    i += 1;
  }
  flush();
  return tokens;
}

export function tokenize(code: string, language: string): Token[][] {
  return code
    .replace(/\t/g, '  ')
    .split('\n')
    .map((line) => tokenizeLine(line, language));
}
