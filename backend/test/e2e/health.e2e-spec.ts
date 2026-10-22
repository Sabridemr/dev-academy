import { useE2eApp, type Http } from './helpers';

describe('DevAcademy API (e2e)', () => {
  const e2e = useE2eApp();
  let http: Http;
  beforeAll(() => {
    ({ http } = e2e);
  });

  describe('health', () => {
    it('GET /health liveness', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });
    it('GET /health/ready veritabanını kontrol eder', async () => {
      const res = await http.get('/health/ready').expect(200);
      expect(res.body.checks.database).toBe('up');
    });
  });
});
