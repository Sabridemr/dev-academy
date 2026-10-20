import type { Metadata } from 'next';
import { ModulesView } from '@/components/pages/ModulesView';
import { localizedMetadata } from '@/lib/metadata';

export function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ tr: 'Modüller', en: 'Modules' });
}

export default function ModulesPage() {
  return <ModulesView />;
}
