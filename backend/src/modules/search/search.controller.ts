import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { SearchResponse } from '@devacademy/shared';
import { Public } from '../../common/auth/decorators';
import { SearchService } from './search.service';
import { clampInt } from '../../common/utils/query';

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
    return this.search.search(q, clampInt(limit, 20, 1, 50));
  }
}
