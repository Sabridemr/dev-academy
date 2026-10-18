import { ModuleView } from '@/components/pages/ModuleView';

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  return <ModuleView moduleId={moduleId} />;
}
