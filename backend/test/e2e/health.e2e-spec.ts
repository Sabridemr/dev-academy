import { prefix, useE2eApp, type Http } from './helpers';

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

  describe('metrics', () => {
    it('GET /metrics kimlik doğrulamasız Prometheus metriklerini döner (prefix dışında)', async () => {
      await http.get('/health').expect(200);
      const res = await http.get('/metrics').expect(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('process_cpu_user_seconds_total');
      expect(res.text).toMatch(/http_requests_total\{method="GET",route="\/health",status="200"\}/);
      await http.get(`${prefix}/metrics`).expect(404);
    });
  });
});
