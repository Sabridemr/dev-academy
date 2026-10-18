import type { Metadata } from 'next';
import { ModulesView } from '@/components/pages/ModulesView';

export const metadata: Metadata = { title: 'Modüller' };

export default function ModulesPage() {
  return <ModulesView />;
}
