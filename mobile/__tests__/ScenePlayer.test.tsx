import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AnimationSceneSchema, type AnimationSceneInput } from '@devacademy/shared';
import { ScenePlayer } from '@/components/scene/ScenePlayer';
import { useSettings } from '@/stores/settings';

/**
 * Mobil animasyon motoru: shared playerReducer ile adım ilerletme, oynatma (TICK), seek,
 * reduced-motion ve transkript davranışları.
 */
const input: AnimationSceneInput = {
  id: 'test-scene',
  title: { tr: 'Test sahnesi', en: 'Test scene' },
  a11y: { description: { tr: 'İstemci sunucuya istek gönderir.', en: 'Client sends a request to the server.' } },
  nodes: [
    { id: 'client', kind: 'client', label: { tr: 'İstemci', en: 'Client' }, x: 200, y: 300 },
    { id: 'server', kind: 'server', label: { tr: 'Sunucu', en: 'Server' }, x: 800, y: 300 },
  ],
  edges: [{ id: 'e1', from: 'client', to: 'server', label: 'HTTP' }],
  steps: [
    { id: 's1', title: { tr: 'Başlangıç', en: 'Start' }, narration: { tr: 'İki düğüm var.', en: 'Two nodes.' }, durationMs: 1000 },
    {
      id: 's2',
      title: { tr: 'İstek', en: 'Request' },
      narration: { tr: 'İstek gönderilir.', en: 'Request is sent.' },
      durationMs: 1000,
      highlight: { nodes: ['client'], edges: ['e1'] },
      nodeStates: { server: { status: 'busy', badge: 'x1' } },
      packets: [{ edge: 'e1', startAt: 0, durationMs: 800 }],
    },
    { id: 's3', title: { tr: 'Yanıt', en: 'Response' }, narration: { tr: 'Sunucu yanıt verir.', en: 'Server responds.' }, durationMs: 1000, nodeStates: { server: { status: 'success' } } },
  ],
};
const scene = AnimationSceneSchema.parse(input);

const originalRaf = global.requestAnimationFrame;
const originalCancel = global.cancelAnimationFrame;

beforeEach(() => {
  jest.useFakeTimers();
  // 16 ms'lik kare: sahte zamanlayıcılarla gerçekçi kare döngüsü
  global.requestAnimationFrame = ((cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  global.cancelAnimationFrame = ((id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame;
  useSettings.setState({ locale: 'tr' });
});

afterEach(() => {
  jest.useRealTimers();
  global.requestAnimationFrame = originalRaf;
  global.cancelAnimationFrame = originalCancel;
  jest.restoreAllMocks();
});

async function renderPlayer() {
  const utils = render(<ScenePlayer scene={scene} />);
  // reduced-motion sorgusunun çözülmesini bekle
  await act(async () => {
    await Promise.resolve();
  });
  // Canvas genişliği onLayout ile gelir
  act(() => {
    fireEvent(screen.getByTestId('scene-canvas-container'), 'layout', { nativeEvent: { layout: { width: 360, height: 216, x: 0, y: 0 } } });
  });
  expect(screen.getByTestId('scene-canvas')).toBeTruthy();
  return utils;
}

describe('ScenePlayer', () => {
  it('ilk adımı ve anlatımı gösterir', async () => {
    render(<ScenePlayer scene={scene} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent('Adım 1/3 · Başlangıç');
    expect(screen.getByTestId('scene-narration')).toHaveTextContent(/İki düğüm var\./);
  });

  it('adım ileri / geri ve seek reducer ile çalışır', async () => {
    render(<ScenePlayer scene={scene} />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.press(screen.getByTestId('scene-next'));
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent('Adım 2/3 · İstek');
    fireEvent.press(screen.getByTestId('scene-prev'));
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent(/Adım 1\/3/);
    fireEvent.press(screen.getByTestId('scene-seek-2'));
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent('Adım 3/3 · Yanıt');
  });

  it('oynatınca zaman ilerler ve adımlar otomatik değişir', async () => {
    await renderPlayer();
    fireEvent.press(screen.getByTestId('scene-play'));
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent(/Adım 2\/3/);
    // Paket ikinci adımda kenar üzerinde hareket ediyor
    expect(screen.queryAllByTestId('scene-packet').length).toBeGreaterThan(0);
    act(() => {
      jest.advanceTimersByTime(2200);
    });
    // Son adımın sonunda oynatma durur
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent(/Adım 3\/3/);
    expect(screen.getByText('Oynat')).toBeTruthy();
  });

  it('hız seçimi uygulanır (2× daha hızlı ilerler)', async () => {
    await renderPlayer();
    fireEvent.press(screen.getByTestId('scene-speed-2'));
    fireEvent.press(screen.getByTestId('scene-play'));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByTestId('scene-step-label')).toHaveTextContent(/Adım 2\/3/);
  });

  it('reduced-motion açıkken bilgi gösterir', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<ScenePlayer scene={scene} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Hareket azaltıldı/)).toBeTruthy();
  });

  it('erişilebilir transkripti açar', async () => {
    render(<ScenePlayer scene={scene} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('scene-transcript')).toBeNull();
    fireEvent.press(screen.getByTestId('scene-transcript-toggle'));
    expect(screen.getByTestId('scene-transcript')).toHaveTextContent(/İstemci sunucuya istek gönderir\./);
    expect(screen.getByTestId('scene-transcript')).toHaveTextContent(/3\. Sunucu yanıt verir\./);
  });

  it('anlatım gizlenip gösterilebilir', async () => {
    render(<ScenePlayer scene={scene} />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.press(screen.getByTestId('scene-narration-toggle'));
    expect(screen.queryByTestId('scene-narration')).toBeNull();
  });
});
