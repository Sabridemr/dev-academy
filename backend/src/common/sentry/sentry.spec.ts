import {
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { captureServerError, initSentry, isSentryEnabled, resetSentryForTests } from './sentry';

const captureException = jest.fn();
const init = jest.fn();
const scope = { setTag: jest.fn() };
jest.mock('@sentry/nestjs', () => ({
  init: (...args: unknown[]) => init(...args),
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (cb: (s: typeof scope) => void) => cb(scope),
}));

function host() {
  const res: { status: jest.Mock; json: jest.Mock } = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const req = { id: 'req-1', method: 'GET', route: { path: '/api/v1/lessons/:id' }, baseUrl: '' };
  return {
    res,
    host: {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as never,
  };
}

describe('Sentry', () => {
  const filter = new HttpExceptionFilter();

  // Filtrenin 5xx loglarını test çıktısından gizle
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

  beforeEach(() => {
    jest.clearAllMocks();
    resetSentryForTests();
  });

  it('SENTRY_DSN yoksa başlatılmaz ve hata gönderilmez', () => {
    expect(initSentry({ NODE_ENV: 'test' })).toBe(false);
    expect(initSentry({ SENTRY_DSN: '' })).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(isSentryEnabled()).toBe(false);
    captureServerError(new Error('x'), { status: 500 });
    filter.catch(new Error('beklenmeyen'), host().host);
    expect(captureException).not.toHaveBeenCalled();
  });

  describe('SENTRY_DSN verildiğinde', () => {
    beforeEach(() => {
      expect(
        initSentry({
          SENTRY_DSN: 'https://public@o0.ingest.sentry.io/1',
          SENTRY_TRACES_SAMPLE_RATE: '0.25',
          NODE_ENV: 'production',
        }),
      ).toBe(true);
    });

    it('DSN, ortam ve örnekleme oranıyla başlatılır', () => {
      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://public@o0.ingest.sentry.io/1',
          environment: 'production',
          tracesSampleRate: 0.25,
        }),
      );
    });

    it('5xx hataları gönderilir (istek kimliği ve route etiketiyle)', () => {
      const err = new Error('beklenmeyen');
      const h = host();
      filter.catch(err, h.host);
      expect(h.res.status).toHaveBeenCalledWith(500);
      expect(captureException).toHaveBeenCalledWith(err);
      expect(scope.setTag).toHaveBeenCalledWith('request_id', 'req-1');
      expect(scope.setTag).toHaveBeenCalledWith('http.route', '/api/v1/lessons/:id');

      filter.catch(new ServiceUnavailableException(), host().host);
      expect(captureException).toHaveBeenCalledTimes(2);
    });

    it('4xx hataları gönderilmez', () => {
      filter.catch(new NotFoundException(), host().host);
      filter.catch(new BadRequestException('geçersiz'), host().host);
      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
