import { Injectable, NotFoundException } from '@nestjs/common';
import type { BookmarkDto, CreateBookmarkDto, NoteDto, UpsertNoteDto } from '@devacademy/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { ProgressService } from '../progress/progress.service';

/** Yer imleri ve notlar ("kütüphane") */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  /* ------------------------------ Yer imleri ----------------------------- */

  async listBookmarks(userId: string): Promise<BookmarkDto[]> {
    const rows = await this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        lesson: {
          select: {
            id: true,
            slug: true,
            moduleId: true,
            publishedVersion: { select: { title: true } },
          },
        },
      },
    });
    return rows.map((b) => ({
      id: b.id,
      lessonId: b.lessonId,
      blockId: b.blockId || null,
      createdAt: b.createdAt.toISOString(),
      lesson: {
        id: b.lesson.id,
        slug: b.lesson.slug,
        moduleId: b.lesson.moduleId,
        title: asLocalized(b.lesson.publishedVersion?.title),
      },
    }));
  }

  async addBookmark(userId: string, dto: CreateBookmarkDto): Promise<BookmarkDto> {
    await this.ensureLesson(dto.lessonId);
    // Eş zamanlı iki istek aynı yer imini döndürür: unique kısıt kopyayı engeller, kaybeden istek
    // (P2002) mevcut kaydı okur; istemci 409 görmez
    const key = { userId, lessonId: dto.lessonId, blockId: dto.blockId ?? '' };
    const row =
      (await this.prisma.bookmark.findUnique({ where: { userId_lessonId_blockId: key } })) ??
      (await this.prisma.bookmark.create({ data: key }).catch(async (err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
          return this.prisma.bookmark.findUniqueOrThrow({
            where: { userId_lessonId_blockId: key },
          });
        throw err;
      }));
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: dto.lessonId },
      select: {
        id: true,
        slug: true,
        moduleId: true,
        publishedVersion: { select: { title: true } },
      },
    });
    return {
      id: row.id,
      lessonId: row.lessonId,
      blockId: row.blockId || null,
      createdAt: row.createdAt.toISOString(),
      lesson: {
        id: lesson.id,
        slug: lesson.slug,
        moduleId: lesson.moduleId,
        title: asLocalized(lesson.publishedVersion?.title),
      },
    };
  }

  async removeBookmark(userId: string, id: string): Promise<void> {
    const r = await this.prisma.bookmark.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw new NotFoundException('Yer imi bulunamadı');
  }

  /* -------------------------------- Notlar ------------------------------- */

  async listNotes(userId: string, lessonId?: string): Promise<NoteDto[]> {
    const rows = await this.prisma.note.findMany({
      where: { userId, ...(lessonId ? { lessonId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toNote);
  }

  async createNote(userId: string, dto: UpsertNoteDto): Promise<NoteDto> {
    await this.ensureLesson(dto.lessonId);
    const row = await this.prisma.note.create({
      data: { userId, lessonId: dto.lessonId, blockId: dto.blockId ?? null, body: dto.body },
    });
    await this.progress.recordActivity(userId, { note: true });
    return toNote(row);
  }

  async updateNote(userId: string, id: string, body: string): Promise<NoteDto> {
    const existing = await this.prisma.note.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Not bulunamadı');
    const row = await this.prisma.note.update({ where: { id }, data: { body } });
    return toNote(row);
  }

  async removeNote(userId: string, id: string): Promise<void> {
    const r = await this.prisma.note.deleteMany({ where: { id, userId } });
    if (r.count === 0) throw new NotFoundException('Not bulunamadı');
  }

  private async ensureLesson(lessonId: string): Promise<void> {
    const exists = await this.prisma.lesson.count({ where: { id: lessonId } });
    if (!exists) throw new NotFoundException('Ders bulunamadı');
  }
}

function toNote(n: {
  id: string;
  lessonId: string;
  blockId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}): NoteDto {
  return {
    id: n.id,
    lessonId: n.lessonId,
    blockId: n.blockId,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}
