'use client';

import { useState } from 'react';
import { Check, Copy, Download, FileDown } from 'lucide-react';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { Dialog } from '@/components/ui/Dialog';

/** POST /admin/lessons/:id/export yanıtı (backend ContentExportService) */
export interface LessonExportResponse {
  lessonId: string;
  version: number;
  status: string;
  files: { path: string; content: string; encoding: 'utf8' | 'base64' }[];
  warnings: string[];
}

function toBlob(file: LessonExportResponse['files'][number]): Blob {
  if (file.encoding === 'utf8')
    return new Blob([file.content], { type: 'text/plain;charset=utf-8' });
  const bin = atob(file.content);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes]);
}

function download(file: LessonExportResponse['files'][number]): void {
  const url = URL.createObjectURL(toBlob(file));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.path.split('/').pop() ?? 'dosya';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Panelde düzenlenen dersi content/ dosyalarına (lesson.md, svg, sahne, quiz…) çevirir ve gösterir.
 * Sunucu dosya yazmaz; editör dosyaları kopyalayıp depoya koyar (seed'in paneli ezmemesi için).
 */
export function ContentExportDialog({
  lessonId,
  versionId,
}: {
  lessonId: string;
  versionId?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LessonExportResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<LessonExportResponse>(`/admin/lessons/${lessonId}/export`, {
        method: 'POST',
        body: versionId ? { versionId } : {},
      });
      setResult(r);
      setOpen(true);
    } catch (e) {
      setError(`${t('admin.exportFailed')}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(path);
    } catch {
      setCopied(null);
    }
  };

  return (
    <>
      <button type="button" className="btn-ghost" onClick={run} disabled={busy}>
        <FileDown size={14} /> {t('admin.exportContent')}
      </button>
      {error && (
        <span className="text-sm text-danger" role="alert">
          {error}
        </span>
      )}
      <Dialog
        open={open && result !== null}
        onClose={() => setOpen(false)}
        title={t('admin.exportTitle')}
        description={
          result
            ? t('admin.exportHint', {
                version: result.version,
                status: result.status,
                count: result.files.length,
              })
            : undefined
        }
        size="xl"
      >
        {result && (
          <div className="space-y-4">
            {result.warnings.length > 0 && (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold">{t('admin.exportWarnings')}</p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.files.map((f) => (
              <section key={f.path} className="rounded-md border border-border">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <code className="break-all text-xs">{f.path}</code>
                  <div className="flex gap-2">
                    {f.encoding === 'utf8' && (
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => copy(f.path, f.content)}
                      >
                        {copied === f.path ? <Check size={14} /> : <Copy size={14} />}{' '}
                        {copied === f.path ? t('admin.exportCopied') : t('admin.exportCopy')}
                      </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => download(f)}>
                      <Download size={14} /> {t('admin.exportDownload')}
                    </button>
                  </div>
                </header>
                {f.encoding === 'utf8' && (
                  <pre className="max-h-64 overflow-auto p-3 text-xs">{f.content}</pre>
                )}
              </section>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}
