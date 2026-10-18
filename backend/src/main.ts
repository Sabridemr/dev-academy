import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOrigins, type Env } from './config/env';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix(config.get('API_PREFIX'), { exclude: ['health', 'health/ready'] });
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: corsOrigins({ CORS_ORIGINS: config.get('CORS_ORIGINS') } as Env),
    credentials: true,
    exposedHeaders: ['ETag', 'X-Request-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'X-Request-Id'],
  });
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('DevAcademy API')
    .setDescription('Yazılım mimarisi ve yapay zekâ öğrenme platformu — REST + WebSocket API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addServer(`/`)
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs/openapi.json', swaggerOptions: { persistAuthorization: true } });

  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT');
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`DevAcademy API http://localhost:${port}/${config.get('API_PREFIX')} — dokümantasyon: http://localhost:${port}/docs`);
}

if (require.main === module) {
  void bootstrap();
}
