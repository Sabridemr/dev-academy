'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { InteractiveType } from '@devacademy/shared';
import type { SimulatorProps } from './types';

function Loading() {
  return <div className="card h-64 animate-pulse bg-elevated/60" aria-busy="true" />;
}

const load = (loader: () => Promise<{ default: ComponentType<SimulatorProps> }>) => dynamic(loader, { ssr: false, loading: Loading });

/**
 * interactive türü → simülatör bileşeni (lazy-load). Her simülatör ayrı bundle'dır,
 * böylece TensorFlow.js gibi ağır bağımlılıklar yalnızca gereken derste yüklenir.
 * Kaydı olmayan türler için InteractiveBlock bir yedek gösterir.
 */
export const SIMULATORS: Partial<Record<InteractiveType, ComponentType<SimulatorProps>>> = {
  'load-balancer': load(() => import('./LoadBalancerSim')),
};
