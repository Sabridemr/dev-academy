import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

/**
 * Kutlama animasyonu (Lottie) — quiz geçildiğinde / rozet kazanıldığında gösterilir.
 * Animasyon JSON'u uygulamaya gömülüdür: assets/animations/celebration.json
 * Reduced-motion açıksa animasyon oynatılmaz, son kare statik gösterilir.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro varlık çözümlemesi require ile çalışır
const CELEBRATION = require('../../../assets/animations/celebration.json') as object;

export function Celebration({ size = 160, onFinish }: { size?: number; onFinish?: () => void }) {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => setReduced(false));
  }, []);
  if (reduced === null) return <View style={{ width: size, height: size }} />;
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="celebration">
      <LottieView
        source={CELEBRATION}
        autoPlay={!reduced}
        progress={reduced ? 1 : undefined}
        loop={false}
        onAnimationFinish={onFinish}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
