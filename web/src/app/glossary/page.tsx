import type { Metadata } from 'next';
import type { ConceptSummary } from '@devacademy/shared';
import { serverApi } from '@/lib/api';
import { localizedMetadata } from '@/lib/metadata';
import { GlossaryView } from '@/components/glossary/GlossaryView';

export function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ tr: 'Kavram sözlüğü', en: 'Concept glossary' });
}

/** Sözlük sunucuda alınır (arama motorları tüm tanımları görür); arama ve süzme istemcide */
export default async function GlossaryPage() {
  let initial: ConceptSummary[] | undefined;
  try {
    initial = await serverApi<ConceptSummary[]>('/concepts', 300);
  } catch {
    initial = undefined; // API'ye ulaşılamazsa istemci yeniden dener
  }
  return <GlossaryView initial={initial} />;
}
