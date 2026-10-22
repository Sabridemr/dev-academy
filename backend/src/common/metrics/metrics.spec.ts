import { Controller, Get, Param, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { THROTTLER_SKIP } from '@nestjs/throttler/dist/throttler.constants';
import request from 'supertest';
import { IS_PUBLIC_KEY } from '../auth/decorators';
import { routeLabel } from './http-metrics.middleware';
import { MetricsController } from './metrics.controller';
import { MetricsModule } from './metrics.module';
import { MetricsService, UNMATCHED_ROUTE } from './metrics.service';

@Controller('items')
class ItemsController {
  @Get(':id')
  get(@Param('id') id: string) {
    return { id };
  }
}

async function createTestApp(metricsEnabled: boolean): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ METRICS_ENABLED: metricsEnabled })],
      }),
      MetricsModule,
    ],
    controllers: [ItemsController],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  // main.ts ile aynı: /metrics global prefix dışında
  app.setGlobalPrefix('api/v1', { exclude: ['metrics'] });
  await app.init();
  return app;
}

describe('MetricsModule', () => {
  describe('METRICS_ENABLED=true', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp(true);
    });
    afterAll(() => app.close());

    it('/metrics Prometheus metin biçiminde Node varsayılan metriklerini döner', async () => {
      const res = await request(app.getHttpServer()).get('/metrics').expect(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('process_cpu_user_seconds_total');
      expect(res.text).toContain('# TYPE http_requests_total counter');
    });

    it('istek sayacı artar ve route etiketi ham URL değil route desenidir', async () => {
      const http = request(app.getHttpServer());
      await http.get('/api/v1/items/42').expect(200);
      await http.get('/api/v1/items/43').expect(200);
      const text = (await http.get('/metrics')).text;
      expect(text).toMatch(
        /http_requests_total\{method="GET",route="\/api\/v1\/items\/:id",status="200"\} 2/,
      );
      expect(text).toMatch(
        /http_request_duration_seconds_count\{method="GET",route="\/api\/v1\/items\/:id",status="200"\} 2/,
      );
      expect(text).not.toContain('items/42');
    });

    it('eşleşmeyen istekler tek "unmatched" etiketinde toplanır, /metrics kendini saymaz', async () => {
      const http = request(app.getHttpServer());
      await http.get('/api/v1/yok/1').expect(404);
      await http.get('/api/v1/yok/2').expect(404);
      const text = (await http.get('/metrics')).text;
      expect(text).toMatch(
        new RegExp(
          `http_requests_total\\{method="GET",route="${UNMATCHED_ROUTE}",status="404"\\} 2`,
        ),
      );
      expect(text).not.toMatch(/route="\/metrics"/);
    });

    it('WebSocket gauge ve cache sayaçları metin çıktısına yansır', async () => {
      const metrics = app.get(MetricsService);
      metrics.wsConnected();
      metrics.wsConnected();
      metrics.wsDisconnected();
      metrics.cacheLookup('content', true);
      metrics.cacheLookup('content', false);
      metrics.cacheLookup('content', false);
      const text = await metrics.render();
      expect(text).toMatch(/ws_connections_active 1/);
      expect(text).toMatch(/cache_lookups_total\{cache="content",result="hit"\} 1/);
      expect(text).toMatch(/cache_lookups_total\{cache="content",result="miss"\} 2/);
    });
  });

  describe('METRICS_ENABLED=false', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createTestApp(false);
    });
    afterAll(() => app.close());

    it('/metrics 404 döner ve hiçbir şey kaydedilmez', async () => {
      const http = request(app.getHttpServer());
      await http.get('/api/v1/items/1').expect(200);
      await http.get('/metrics').expect(404);
      const metrics = app.get(MetricsService);
      metrics.cacheLookup('content', true);
      const text = await metrics.render();
      expect(text).not.toMatch(/http_requests_total\{/);
      expect(text).not.toMatch(/cache_lookups_total\{/);
      expect(text).not.toContain('process_cpu_user_seconds_total');
    });
  });

  it('/metrics JWT guard ve rate limit dışındadır', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MetricsController)).toBe(true);
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}default`, MetricsController)).toBe(true);
  });

  it('routeLabel: baseUrl + route deseni, route yoksa unmatched', () => {
    expect(routeLabel({ baseUrl: '', route: { path: '/api/v1/lessons/:id' } })).toBe(
      '/api/v1/lessons/:id',
    );
    expect(routeLabel({ baseUrl: '/admin', route: { path: '/users/:id' } })).toBe(
      '/admin/users/:id',
    );
    expect(routeLabel({})).toBe(UNMATCHED_ROUTE);
  });
});
