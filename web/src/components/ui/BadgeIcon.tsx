import {
  Award,
  Brain,
  FlaskConical,
  Flame,
  Footprints,
  Medal,
  Network,
  NotebookPen,
  Sparkles,
  Sun,
  Timer,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

/** Rozet tanımındaki `icon` anahtarı → Lucide ikon (shared/gamification ile uyumlu) */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  footprints: Footprints,
  medal: Medal,
  trophy: Trophy,
  flame: Flame,
  sun: Sun,
  sparkles: Sparkles,
  timer: Timer,
  'flask-conical': FlaskConical,
  'notebook-pen': NotebookPen,
  network: Network,
  brain: Brain,
};

export function BadgeIcon({
  icon,
  size = 20,
  className,
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  const Icon = BADGE_ICONS[icon] ?? Award;
  return <Icon size={size} className={className} />;
}
