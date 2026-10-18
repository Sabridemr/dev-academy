import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CreateBookmarkSchema, UpsertNoteSchema } from '@devacademy/shared';
import type { BookmarkDto, CreateBookmarkDto, NoteDto, UpsertNoteDto } from '@devacademy/shared';
import { CurrentUser, type AuthUser } from '../../common/auth/decorators';
import { zodBody } from '../../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../../common/swagger/zod-openapi';
import { LibraryService } from './library.service';

const UpdateNoteSchema = z.object({ body: z.string().min(1).max(5000) });

@ApiTags('library')
@ApiBearerAuth()
@Controller()
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('bookmarks')
  @ApiOperation({ summary: 'Yer imlerini listele' })
  bookmarks(@CurrentUser() user: AuthUser): Promise<BookmarkDto[]> {
    return this.library.listBookmarks(user.id);
  }

  @Post('bookmarks')
  @ApiOperation({ summary: 'Yer imi ekle (ders ya da ders içindeki blok)' })
  @ApiZodBody(CreateBookmarkSchema)
  addBookmark(@CurrentUser() user: AuthUser, @Body(zodBody(CreateBookmarkSchema)) dto: CreateBookmarkDto): Promise<BookmarkDto> {
    return this.library.addBookmark(user.id, dto);
  }

  @Delete('bookmarks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Yer imini sil' })
  removeBookmark(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.library.removeBookmark(user.id, id);
  }

  @Get('notes')
  @ApiOperation({ summary: 'Notları listele' })
  @ApiQuery({ name: 'lessonId', required: false })
  notes(@CurrentUser() user: AuthUser, @Query('lessonId') lessonId?: string): Promise<NoteDto[]> {
    return this.library.listNotes(user.id, lessonId);
  }

  @Post('notes')
  @ApiOperation({ summary: 'Not oluştur' })
  @ApiZodBody(UpsertNoteSchema)
  createNote(@CurrentUser() user: AuthUser, @Body(zodBody(UpsertNoteSchema)) dto: UpsertNoteDto): Promise<NoteDto> {
    return this.library.createNote(user.id, dto);
  }

  @Patch('notes/:id')
  @ApiOperation({ summary: 'Notu güncelle' })
  @ApiZodBody(UpdateNoteSchema)
  updateNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(zodBody(UpdateNoteSchema)) dto: z.infer<typeof UpdateNoteSchema>): Promise<NoteDto> {
    return this.library.updateNote(user.id, id, dto.body);
  }

  @Delete('notes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Notu sil' })
  removeNote(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.library.removeNote(user.id, id);
  }
}
