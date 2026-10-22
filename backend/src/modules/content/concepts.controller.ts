import { Controller, Get, Header, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  ConceptListQuerySchema,
  type ConceptDetail,
  type ConceptListQuery,
  type ConceptSummary,
} from '@devacademy/shared';
import { Public } from '../../common/auth/decorators';
import { EtagInterceptor } from '../../common/interceptors/etag.interceptor';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ConceptsService } from './concepts.service';

/** Kavram sözlüğü: anonim erişime açık, ETag + paylaşılan cache'e uygun */
@ApiTags('content')
@UseInterceptors(EtagInterceptor)
@Controller('concepts')
export class ConceptsController {
  constructor(private readonly concepts: ConceptsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Kavram sözlüğü (terim, kısa tanım, geçtiği ders sayısı)' })
  @ApiQuery({ name: 'q', required: false, description: 'Terim, eş ad ya da tanımda arama' })
  @ApiQuery({ name: 'locale', required: false, enum: ['tr', 'en'] })
  list(@Query(zodBody(ConceptListQuerySchema)) query: ConceptListQuery): Promise<ConceptSummary[]> {
    return this.concepts.list(query.q, query.locale);
  }

  @Public()
  @Get(':id')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'Kavram detayı: tanım, geçtiği dersler, ilgili kavramlar' })
  get(@Param('id') id: string): Promise<ConceptDetail> {
    return this.concepts.get(id);
  }
}
