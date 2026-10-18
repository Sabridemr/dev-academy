import { lastValueFrom, of } from 'rxjs';
import { EtagInterceptor } from './etag.interceptor';

function ctx(method: string, ifNoneMatch?: string) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: (k: string, v: string) => (headers[k] = v),
    getHeader: (k: string) => headers[k],
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  const req = { method, headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {} };
  return {
    headers,
    res,
    context: { switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) } as never,
  };
}

describe('EtagInterceptor', () => {
  const interceptor = new EtagInterceptor();
  const body = { hello: 'dünya' };

  it('GET yanıtına ETag ekler', async () => {
    const c = ctx('GET');
    const out = await lastValueFrom(interceptor.intercept(c.context, { handle: () => of(body) }));
    expect(out).toEqual(body);
    expect(c.headers.ETag).toMatch(/^W\/"/);
  });

  it('If-None-Match eşleşirse 304 ve boş gövde döner', async () => {
    const first = ctx('GET');
    await lastValueFrom(interceptor.intercept(first.context, { handle: () => of(body) }));
    const second = ctx('GET', first.headers.ETag);
    const out = await lastValueFrom(interceptor.intercept(second.context, { handle: () => of(body) }));
    expect(out).toBeUndefined();
    expect(second.res.statusCode).toBe(304);
  });

  it('GET dışı isteklerde dokunmaz', async () => {
    const c = ctx('POST');
    await lastValueFrom(interceptor.intercept(c.context, { handle: () => of(body) }));
    expect(c.headers.ETag).toBeUndefined();
  });
});
