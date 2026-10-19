import type { LocalizedString } from '@devacademy/shared';

/**
 * Ana sayfa vitrininde gösterilen animasyon sahneleri (farklı modüllerden). Sahneler API'den
 * alınır; `lessonId` sahnenin anlatıldığı derse bağlantı içindir, `label` sekmedeki kısa ad.
 */
export const FEATURED_SCENES: { sceneId: string; lessonId: string; label: LocalizedString }[] = [
  {
    sceneId: 'load-balancer-round-robin',
    lessonId: 'a-05-load-balancing',
    label: { tr: 'Load Balancer', en: 'Load Balancer' },
  },
  {
    sceneId: 'a-07-caching-cache-aside',
    lessonId: 'a-07-caching',
    label: { tr: 'Önbellek', en: 'Caching' },
  },
  {
    sceneId: 'c-04-circuit-breaker',
    lessonId: 'c-04-distributed-patterns',
    label: { tr: 'Circuit Breaker', en: 'Circuit Breaker' },
  },
  {
    sceneId: 'e-05-whatsapp-message-journey',
    lessonId: 'e-05-whatsapp-messaging',
    label: { tr: 'WhatsApp Mesajı', en: 'WhatsApp Message' },
  },
  {
    sceneId: 'f-03-kubernetes-hpa-scaling',
    lessonId: 'f-03-kubernetes-basics',
    label: { tr: 'Kubernetes HPA', en: 'Kubernetes HPA' },
  },
  { sceneId: 'g-05-llms-rag', lessonId: 'g-05-llms', label: { tr: 'RAG', en: 'RAG' } },
];
