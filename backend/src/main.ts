import 'reflect-metadata';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ServerOptions } from 'socket.io';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOrigins, type Env } from './config/env';

/** socket.io sunucusuna HTTP ile aynı CORS beyaz listesini uygular (decorator'da env henüz yüklenmemiş olur) */
class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: true } } as ServerOptions);
  }
}

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix(config.get('API_PREFIX'), { exclude: ['health', 'health/ready'] });
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const origins = corsOrigins({ CORS_ORIGINS: config.get('CORS_ORIGINS') } as Env);
  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: ['ETag', 'X-Request-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'X-Request-Id'],
  });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.enableShutdownHooks();

  // API dokümantasyonu yalnızca geliştirme ve test ortamında açık
  if (config.get('NODE_ENV') !== 'production') setupSwagger(app);

  return app;
}

function setupSwagger(app: NestExpressApplication): void {
  const swagger = new DocumentBuilder()
    .setTitle('DevAcademy API')
    .setDescription('Yazılım mimarisi ve yapay zekâ öğrenme platformu — REST + WebSocket API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addServer(`/`)
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json', swaggerOptions: { persistAuthorization: true } });
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT');
  await app.listen(port, '0.0.0.0');
  const docs = config.get('NODE_ENV') !== 'production' ? ` — dokümantasyon: http://localhost:${port}/docs` : '';
  app.get(Logger).log(`DevAcademy API http://localhost:${port}/${config.get('API_PREFIX')}${docs}`);
}

if (require.main === module) {
  void bootstrap();
}
