import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { MetricsService } from './metrics.service';

/**
 * GET /metrics — Prometheus kazıma uç noktası (global prefix dışında, /health gibi).
 * JWT ve rate limit dışındadır; dışarıya açık bir dağıtımda ters vekilde iç ağa sınırlanmalıdır.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res({ passthrough: true }) res: Response): Promise<string> {
    if (!this.metrics.enabled) throw new NotFoundException('Cannot GET /metrics');
    res.setHeader('Content-Type', this.metrics.contentType);
    res.setHeader('Cache-Control', 'no-store');
    return this.metrics.render();
  }
}
