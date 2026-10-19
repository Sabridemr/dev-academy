import { HomeView } from '@/components/pages/HomeView';
import { serverApi } from '@/lib/api';
import type { LearningPathSummary, ModuleSummary } from '@devacademy/shared';

// Sayfa istek başına render edilir (dil çerezi + CSP nonce'u); API verisi serverApi'nin revalidate
// süresiyle Next Data Cache'te tutulur, yani her istek API'ye gitmez.

/** Ana sayfa: öğrenme yolları ve modüller sunucu tarafında alınır (SEO + hızlı ilk boyama). */
export default async function HomePage() {
  const [paths, modules] = await Promise.all([
    serverApi<LearningPathSummary[]>('/paths', 300).catch(() => [] as LearningPathSummary[]),
    serverApi<ModuleSummary[]>('/modules', 300).catch(() => [] as ModuleSummary[]),
  ]);
  return <HomeView paths={paths} modules={modules} />;
}
