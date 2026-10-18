import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { SearchResponse } from '@devacademy/shared';
import { Public } from '../../common/auth/decorators';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Ders, kavram ve modül araması' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  find(@Query('q') q = '', @Query('limit') limit?: string): Promise<SearchResponse> {
    return this.search.search(q, limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20);
  }
}
