import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown, markdownHeadingText, slugify } from './Markdown';

describe('Markdown başlık kimlikleri', () => {
  it('satır içi kod/vurgu içeren başlıkta içindekiler bağlantısıyla aynı id üretilir', () => {
    const line = '`GET` ile **önbellekli** [okuma](https://x.y)';
    const { container } = render(<Markdown>{`## ${line}`}</Markdown>);
    const id = container.querySelector('h2')!.id;
    expect(id).not.toContain('object');
    expect(id).toBe(slugify(markdownHeadingText(line)));
    expect(id).toBe('get-ile-onbellekli-okuma');
  });
});
