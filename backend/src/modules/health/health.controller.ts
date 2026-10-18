import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

/**
 * /health      → liveness (süreç ayakta mı)
 * /health/ready → readiness (DB + Redis). Redis opsiyonel kabul edilir (degraded).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness' })
  live() {
    return { status: 'ok', uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000), timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness: veritabanı ve Redis' })
  async ready() {
    const [db, redis] = await Promise.all([this.prisma.ping(), this.redis.ping()]);
    const body = { status: db ? (redis ? 'ok' : 'degraded') : 'down', checks: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' }, timestamp: new Date().toISOString() };
    if (!db) throw new ServiceUnavailableException(body);
    return body;
  }
}
