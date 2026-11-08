import type { Metadata } from 'next';
import { MatchGamePage } from '@/components/game/MatchGamePage';
import { localizedMetadata } from '@/lib/metadata';

export function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ tr: 'Kelime eşleştirme', en: 'Word matching' });
}

export default function Page() {
  return <MatchGamePage />;
}
