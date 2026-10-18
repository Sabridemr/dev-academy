import { act, renderHook } from '@testing-library/react-native';
import { MESSAGES, translate, translateNow, useI18n } from '@/i18n';
import { en } from '@/i18n/messages/en';
import { tr } from '@/i18n/messages/tr';
import { kv, KV_KEYS } from '@/lib/storage';
import { useSettings } from '@/stores/settings';

/** Nesnedeki tüm yaprak anahtar yollarını toplar */
function leafKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj === 'string' || Array.isArray(obj)) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  beforeEach(() => {
    kv.clearAll();
    useSettings.setState({ locale: 'tr' });
  });

  it('anahtar yolu ve parametrelerle çevirir', () => {
    expect(translate(tr, 'player.step', { current: 2, total: 5 })).toBe('Adım 2/5');
    expect(translate(en, 'player.step', { current: 2, total: 5 })).toBe('Step 2/5');
    expect(translate(tr, 'quiz.score', { score: 80 })).toBe('Puan: %80');
  });

  it('bilinmeyen anahtar için anahtarın kendisini döner, eksik parametreyi korur', () => {
    expect(translate(tr, 'does.not.exist')).toBe('does.not.exist');
    expect(translate(tr, 'player.step', { current: 1 })).toBe('Adım 1/{total}');
  });

  it('tr ve en aynı anahtar kümesine sahiptir', () => {
    expect(leafKeys(MESSAGES.en).sort()).toEqual(leafKeys(MESSAGES.tr).sort());
  });

  it('useI18n dili değiştirir, MMKV’ye kaydeder ve içerik metnini (tl) çözer', () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.locale).toBe('tr');
    expect(result.current.t('nav.home')).toBe('Ana sayfa');
    expect(result.current.tl({ tr: 'Önbellek', en: 'Cache' })).toBe('Önbellek');

    act(() => result.current.setLocale('en'));
    expect(result.current.locale).toBe('en');
    expect(result.current.t('nav.home')).toBe('Home');
    expect(result.current.tl({ tr: 'Önbellek', en: 'Cache' })).toBe('Cache');
    // İngilizcesi olmayan içerik Türkçeye düşer
    expect(result.current.tl({ tr: 'Yalnızca Türkçe' })).toBe('Yalnızca Türkçe');
    expect(kv.getString(KV_KEYS.locale)).toBe('en');
  });

  it('React dışı translateNow aktif dili kullanır', () => {
    useSettings.getState().setLocale('en');
    expect(translateNow('notifications.reminderTitle')).toBe('Time to learn!');
    useSettings.getState().setLocale('tr');
    expect(translateNow('notifications.reminderTitle')).toBe('Öğrenme zamanı!');
  });
});
