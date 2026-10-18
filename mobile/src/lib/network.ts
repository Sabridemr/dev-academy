import { useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { setOfflineFlag } from './api';

/**
 * Ağ durumu takibi (NetInfo).
 * - API istemcisine çevrimdışı bayrağını iletir
 * - React Query onlineManager'ı besler (çevrimdışıyken sorgular duraklar, dönünce yenilenir)
 * - Çevrimiçi olunca kayıtlı dinleyiciler (kuyruk boşaltma, senkron) tetiklenir
 */
type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let currentOnline = true;

function isOnlineState(state: NetInfoState): boolean {
  // isInternetReachable null ise (henüz bilinmiyor) bağlantıyı yeterli say
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

let started = false;
export function startNetworkMonitoring(): () => void {
  if (started) return () => undefined;
  started = true;
  const unsubscribe = NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);
    const changed = online !== currentOnline;
    currentOnline = online;
    setOfflineFlag(!online);
    onlineManager.setOnline(online);
    if (changed) listeners.forEach((l) => l(online));
  });
  return () => {
    started = false;
    unsubscribe();
  };
}

export function isOnline(): boolean {
  return currentOnline;
}

/** Çevrimiçi/çevrimdışı geçişlerinde çağrılır */
export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(currentOnline);
  useEffect(() => {
    setOnline(currentOnline);
    return onConnectivityChange(setOnline);
  }, []);
  return online;
}
