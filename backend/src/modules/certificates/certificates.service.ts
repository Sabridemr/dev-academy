import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Certificate, type CertificateTarget } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { CertificateDto, LocalizedString } from '@devacademy/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { asLocalized } from '../../common/utils/localized';
import { publishedLessonIdsForPath } from './path-lessons';

/** Paylaşılabilir kimlik: 16 karakter base64url (96 bit), tahmin edilemez */
export function newPublicId(): string {
  return randomBytes(12).toString('base64url');
}

/**
 * Modül ve öğrenme yolu sertifikaları. Sertifika ProgressService tarafından (modül/yol tamamlanınca)
 * üretilir; herkese açık doğrulama sayfası publicId ile okunur.
 */
@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Sertifika üretir; kullanıcının bu hedef için zaten sertifikası varsa null döner (idempotent) */
  async issue(
    userId: string,
    targetType: CertificateTarget,
    targetId: string,
  ): Promise<CertificateDto | null> {
    let cert: Certificate;
    try {
      cert = await this.prisma.certificate.create({
        data: { userId, targetType, targetId, publicId: newPublicId() },
      });
    } catch (err) {
      // Eş zamanlı iki tamamlama aynı sertifikayı üretmeye çalışabilir; unique ihlali "zaten var" demektir
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null;
      throw err;
    }
    const [dto] = await this.toDtos([cert]);
    return dto;
  }

  async listMine(userId: string): Promise<CertificateDto[]> {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
    });
    return this.toDtos(rows);
  }

  async getPublic(publicId: string): Promise<CertificateDto> {
    const cert = await this.prisma.certificate.findUnique({ where: { publicId } });
    if (!cert) throw new NotFoundException('Sertifika bulunamadı');
    const [dto] = await this.toDtos([cert]);
    return dto;
  }

  /** Başlık, kullanıcı adı ve ders sayısı toplu sorgularla eklenir */
  private async toDtos(rows: Certificate[]): Promise<CertificateDto[]> {
    if (rows.length === 0) return [];
    const moduleIds = rows.filter((r) => r.targetType === 'module').map((r) => r.targetId);
    const pathIds = rows.filter((r) => r.targetType === 'path').map((r) => r.targetId);
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const [users, modules, moduleCounts, paths] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true },
      }),
      this.prisma.module.findMany({
        where: { id: { in: moduleIds } },
        select: { id: true, title: true },
      }),
      this.prisma.lesson.groupBy({
        by: ['moduleId'],
        where: { moduleId: { in: moduleIds }, publishedVersionId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.learningPath.findMany({
        where: { id: { in: pathIds } },
        select: { id: true, title: true },
      }),
    ]);
    const pathCounts = new Map<string, number>();
    for (const p of paths)
      pathCounts.set(p.id, (await publishedLessonIdsForPath(this.prisma, p.id))?.length ?? 0);
    const userName = new Map(users.map((u) => [u.id, u.displayName]));
    const titles = new Map<string, LocalizedString>([
      ...modules.map((m) => [`module:${m.id}`, asLocalized(m.title)] as const),
      ...paths.map((p) => [`path:${p.id}`, asLocalized(p.title)] as const),
    ]);
    const moduleCount = new Map(moduleCounts.map((m) => [m.moduleId, m._count._all]));
    return rows.map((r) => ({
      id: r.id,
      publicId: r.publicId,
      targetType: r.targetType,
      targetId: r.targetId,
      title: titles.get(`${r.targetType}:${r.targetId}`) ?? r.targetId,
      userName: userName.get(r.userId) ?? '',
      issuedAt: r.issuedAt.toISOString(),
      lessonCount:
        (r.targetType === 'module' ? moduleCount.get(r.targetId) : pathCounts.get(r.targetId)) ?? 0,
    }));
  }
}
