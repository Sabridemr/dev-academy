import { Component, type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Rive, { Fit } from 'rive-react-native';

/**
 * Rive animasyon sarmalayıcısı.
 * - `resourceName`: native projeye gömülü .riv dosyası (iOS: bundle, Android: res/raw) ya da
 * - `url`: uzaktan .riv dosyası
 * Hiçbiri verilmezse, Rive native modülü yüklenemezse ya da çalışma zamanı hatası olursa
 * `fallback` (ör. Lottie <Celebration/>) gösterilir. Depoda henüz .riv varlığı bulunmadığından
 * uygulama şu an fallback yolunu kullanır; .riv eklemek için README → "Rive" bölümüne bakın.
 */
interface Props {
  resourceName?: string;
  url?: string;
  artboardName?: string;
  stateMachineName?: string;
  style?: ViewStyle;
  fallback: ReactNode;
}

interface State {
  failed: boolean;
}

class RiveBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, State> {
  override state: State = { failed: false };
  static getDerivedStateFromError(): State {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function RiveAnimation({ resourceName, url, artboardName, stateMachineName, style, fallback }: Props) {
  if (!resourceName && !url) return <>{fallback}</>;
  const source = resourceName ? { resourceName } : { url: url! };
  return (
    <RiveBoundary fallback={fallback}>
      <View style={style}>
        <Rive {...source} artboardName={artboardName} stateMachineName={stateMachineName} fit={Fit.Contain} autoplay style={{ width: '100%', height: '100%' }} />
      </View>
    </RiveBoundary>
  );
}
