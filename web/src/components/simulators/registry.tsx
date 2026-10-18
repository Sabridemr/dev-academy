'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { InteractiveType } from '@devacademy/shared';
import type { SimulatorProps } from './types';

function Loading() {
  return <div className="card h-64 animate-pulse bg-elevated/60" aria-busy="true" />;
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
