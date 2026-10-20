'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { InteractiveType } from '@devacademy/shared';
import type { SimulatorProps } from './types';
import { Skeleton } from '../ui/Skeleton';

function Loading() {
  return (
    <div className="card overflow-hidden" aria-busy="true">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
        <Skeleton className="h-72 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-2/3" />
        </div>
      </div>
    </div>
  );
}

const load = (loader: () => Promise<{ default: ComponentType<SimulatorProps> }>) =>
  dynamic(loader, { ssr: false, loading: Loading });

/**
 * interactive türü → simülatör bileşeni (lazy-load). Her simülatör ayrı bundle'dır,
 * böylece TensorFlow.js gibi ağır bağımlılıklar yalnızca gereken derste yüklenir.
 * Kaydı olmayan türler için InteractiveBlock bir yedek gösterir.
 */
export const SIMULATORS: Partial<Record<InteractiveType, ComponentType<SimulatorProps>>> = {
  'load-balancer': load(() => import('./LoadBalancerSim')),
  cache: load(() => import('./CacheSim')),
  'rate-limiter': load(() => import('./RateLimiterSim')),
  'consistent-hashing': load(() => import('./ConsistentHashingSim')),
  'gradient-descent': load(() => import('./GradientDescentSim')),
  attention: load(() => import('./AttentionSim')),
  'neural-network-playground': load(() => import('./NeuralNetworkPlaygroundSim')),
  'capacity-estimator': load(() => import('./CapacityEstimatorSim')),
  'er-diagram': load(() => import('./ErDiagramSim')),
  'cap-theorem': load(() => import('./CapTheoremSim')),
  scaling: load(() => import('./ScalingSim')),
  'message-queue': load(() => import('./MessageQueueSim')),
  'replication-quorum': load(() => import('./ReplicationQuorumSim')),
  'index-query-plan': load(() => import('./IndexQueryPlanSim')),
  'isolation-levels': load(() => import('./IsolationLevelsSim')),
  'k-means': load(() => import('./KMeansSim')),
  'decision-tree': load(() => import('./DecisionTreeSim')),
  convolution: load(() => import('./ConvolutionSim')),
  tokenizer: load(() => import('./TokenizerSim')),
  'embedding-space': load(() => import('./EmbeddingSpaceSim')),
  pipeline: load(() => import('./PipelineSim')),
  'kubernetes-hpa': load(() => import('./KubernetesHpaSim')),
  'request-journey': load(() => import('./RequestJourneySim')),
  'traffic-wave': load(() => import('./TrafficWaveSim')),
  'fan-out': load(() => import('./FanOutSim')),
  'geo-index': load(() => import('./GeoIndexSim')),
};
