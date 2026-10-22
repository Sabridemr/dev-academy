import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ConceptDetail } from '@devacademy/shared';
import { ApiError, serverApi } from '@/lib/api';
import { serverLocale } from '@/lib/metadata';
import { ConceptView } from '@/components/glossary/ConceptView';

async function getConcept(id: string): Promise<ConceptDetail> {
  try {
    return await serverApi<ConceptDetail>(`/concepts/${encodeURIComponent(id)}`, 300);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ conceptId: string }>;
}): Promise<Metadata> {
  const { conceptId } = await params;
  try {
    const [concept, locale] = await Promise.all([getConcept(conceptId), serverLocale()]);
    return {
      title: concept.term[locale],
      description: (locale === 'en' ? concept.definition.en : undefined) ?? concept.definition.tr,
    };
  } catch {
    return { title: 'DevAcademy' };
  }
}

export default async function ConceptPage({ params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  const concept = await getConcept(conceptId);
  return <ConceptView initial={concept} />;
}
