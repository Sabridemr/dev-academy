import { HomeView } from '@/components/pages/HomeView';
import { serverApi } from '@/lib/api';
import type { LearningPathSummary, ModuleSummary, SceneResponse } from '@devacademy/shared';
import { FEATURED_SCENES } from '@/components/home/featured-scenes';
import type { ShowcaseScene } from '@/components/home/SceneShowcase';

// Sayfa istek başına render edilir (dil çerezi + CSP nonce'u); API verisi serverApi'nin revalidate
// süresiyle Next Data Cache'te tutulur, yani her istek API'ye gitmez.

/** Ana sayfa: öğrenme yolları, modüller ve vitrin animasyonları sunucu tarafında alınır (SEO + hızlı ilk boyama). */
export default async function HomePage() {
  const [paths, modules, scenes] = await Promise.all([
    serverApi<LearningPathSummary[]>('/paths', 300).catch(() => [] as LearningPathSummary[]),
    serverApi<ModuleSummary[]>('/modules', 300).catch(() => [] as ModuleSummary[]),
    // Yayında olmayan ya da bulunamayan sahne vitrinden düşer (vitrin hiçbir zaman kırılmaz)
    Promise.all(
      FEATURED_SCENES.map(({ sceneId, lessonId, label }) =>
        serverApi<SceneResponse>(`/scenes/${sceneId}`, 300)
          .then((r): ShowcaseScene => ({ scene: r.scene, lessonId, label }))
          .catch(() => null),
      ),
    ).then((list) => list.filter((s): s is ShowcaseScene => s !== null)),
  ]);
  return <HomeView paths={paths} modules={modules} scenes={scenes} />;
}
