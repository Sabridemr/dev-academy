import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CreateExamSchema, SubmitExamSchema } from '@devacademy/shared';
import type { CreateExamDto, ExamDto, ExamResult, SubmitExamDto } from '@devacademy/shared';
import { CurrentUser, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { ExamsService, type ExamDetail, type ExamListItem } from './exams.service';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Deneme sınavı başlat (yol/modül kapsamından rastgele sorular; cevaplar gizli)',
  })
  @ApiZodBody(CreateExamSchema)
  create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(CreateExamSchema)) dto: CreateExamDto,
  ): Promise<ExamDto> {
    return this.exams.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Son sınavlar' })
  list(@CurrentUser() user: AuthUser): Promise<ExamListItem[]> {
    return this.exams.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Sınav (yalnızca sahibi); gönderildiyse sonuç da döner' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ExamDetail> {
    return this.exams.get(user.id, id);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sınavı gönder: puan (geçme 70), kavram/modül kırılımı, süre aşımı, kazanılan XP',
  })
  @ApiZodBody(SubmitExamSchema)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(SubmitExamSchema)) dto: SubmitExamDto,
  ): Promise<ExamResult> {
    return this.exams.submit(user.id, id, dto);
  }
}
