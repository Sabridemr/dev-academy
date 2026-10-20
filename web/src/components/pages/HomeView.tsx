'use client';

import type { LearningPathSummary, ModuleSummary } from '@devacademy/shared';
import { Hero } from '../home/Hero';
import {
  FinalCta,
  HowItWorks,
  ModulesSection,
  PathsSection,
  SimulatorShowcase,
  StatsStrip,
} from '../home/Sections';
import type { ShowcaseScene } from '../home/SceneShowcase';

export { ICONS } from '../home/Sections';

export function HomeView({
  paths,
  modules,
  scenes = [],
}: {
  paths: LearningPathSummary[];
  modules: ModuleSummary[];
  /** Vitrin animasyonları (sunucuda API'den alınır) */
  scenes?: ShowcaseScene[];
}) {
  return (
    <div className="pb-8">
      <Hero scenes={scenes} />
      <StatsStrip modules={modules} />
      <HowItWorks />
      <PathsSection paths={paths} />
      <SimulatorShowcase />
      <ModulesSection modules={modules} />
      <FinalCta />
    </div>
  );
}
