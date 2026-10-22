import { LayoutAnimation, Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { LessonBlock } from '@devacademy/shared';
import { PredictBlockView } from '@/components/lesson/PredictBlockView';
import { ResourcesBlockView } from '@/components/lesson/ResourcesBlockView';

/** Tahmin sorusu ve kaynakça blokları: seçim geri bildirimi, açıklama ve dış bağlantılar */

let mockReduced = false;
jest.mock('@/components/interactive/useReducedMotion', () => ({
  useReducedMotion: () => mockReduced,
}));

afterEach(() => {
  mockReduced = false;
});
const predict = {
  id: 'lb-tahmin',
  order: 0,
  type: 'predict',
  prompt: { tr: 'Dördüncü sunucu eklenince ne olur?' },
  options: [
    { id: 'a', text: { tr: 'Hep ilk sunucu' } },
    { id: 'b', text: { tr: 'Sıraya katılır' } },
  ],
  correct: 'b',
  explanation: { tr: 'Round robin sırayı korur.' },
} as Extract<LessonBlock, { type: 'predict' }>;

describe('PredictBlockView', () => {
  it('yanlış seçimde doğru cevabı ve açıklamayı gösterir; seçenekleri kilitler', () => {
    render(<PredictBlockView block={predict} />);
    expect(screen.queryByText('Round robin sırayı korur.')).toBeNull();

    fireEvent.press(screen.getByTestId('predict-opt-lb-tahmin-a'));

    expect(screen.getByText('Tam değil. Doğru cevap: B) Sıraya katılır')).toBeTruthy();
    expect(screen.getByText('Round robin sırayı korur.')).toBeTruthy();
    expect(screen.getByTestId('predict-opt-lb-tahmin-a').props.accessibilityState).toMatchObject({
      checked: true,
      disabled: true,
    });
    expect(screen.getByTestId('predict-opt-lb-tahmin-b').props.accessibilityState).toMatchObject({
      checked: false,
      disabled: true,
    });
  });

  it('doğru seçimi onaylar ve yeniden deneme ile sıfırlanır', () => {
    render(<PredictBlockView block={predict} />);
    fireEvent.press(screen.getByTestId('predict-opt-lb-tahmin-b'));
    expect(screen.getByText('Doğru tahmin!')).toBeTruthy();

    fireEvent.press(screen.getByText('Yeniden dene'));
    expect(screen.queryByText('Doğru tahmin!')).toBeNull();
    expect(screen.getByText('Devam etmeden önce sence ne olacağını seç.')).toBeTruthy();
  });
});

describe('PredictBlockView hareket tercihi', () => {
  it('"hareketi azalt" açıkken yerleşim animasyonu kullanmaz, kapalıyken kullanır', () => {
    const spy = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);
    mockReduced = true;
    const view = render(<PredictBlockView block={predict} />);
    fireEvent.press(screen.getByTestId('predict-opt-lb-tahmin-a'));
    expect(spy).not.toHaveBeenCalled();
    view.unmount();

    mockReduced = false;
    render(<PredictBlockView block={predict} />);
    fireEvent.press(screen.getByTestId('predict-opt-lb-tahmin-a'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('ResourcesBlockView', () => {
  it('kaynakları türüyle listeler ve bağlantıyı sistem tarayıcısında açar', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const block = {
      id: 'resources-1',
      order: 0,
      type: 'resources',
      items: [
        {
          title: 'Designing Data-Intensive Applications',
          url: 'https://dataintensive.net',
          kind: 'book',
        },
        { title: 'Bir yazı', url: 'https://example.org/yazi', note: 'Kısa not' },
      ],
    } as Extract<LessonBlock, { type: 'resources' }>;
    render(<ResourcesBlockView block={block} />);

    expect(screen.getByText('Kaynakça')).toBeTruthy();
    expect(screen.getByText('Kitap')).toBeTruthy();
    expect(screen.getByText('Kısa not')).toBeTruthy();
    fireEvent.press(screen.getByText('Designing Data-Intensive Applications'));
    expect(open).toHaveBeenCalledWith('https://dataintensive.net');
  });
});
