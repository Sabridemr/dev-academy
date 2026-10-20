import type { Metadata } from 'next';
import type { ModuleDetail } from '@devacademy/shared';
import { t as tl } from '@devacademy/shared';
import { serverApi } from '@/lib/api';
import { ModuleView } from '@/components/pages/ModuleView';

/** Sekme başlığı/açıklaması sunucuda üretilir (SEO); içerik ve ilerleme istemcide yüklenir */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}): Promise<Metadata> {
  const { moduleId } = await params;
  try {
    const m = await serverApi<ModuleDetail>(`/modules/${moduleId}`, 300);
    return { title: tl(m.title), description: tl(m.description) };
  } catch {
    return { title: 'Modül' };
  }
}

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  return <ModuleView moduleId={moduleId} />;
}
