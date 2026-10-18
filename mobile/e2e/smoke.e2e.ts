import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

/**
 * DUMAN TESTİ: giriş → ders aç → animasyonu oynat
 * Ön koşullar: backend çalışıyor ve seed edilmiş (pnpm db:seed). Varsayılan olarak seed'in oluşturduğu
 * yönetici hesabı kullanılır (backend/prisma/seed.ts → SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 * Kimlik bilgileri E2E_EMAIL / E2E_PASSWORD ortam değişkenleriyle değiştirilebilir.
 */
const EMAIL = process.env.E2E_EMAIL ?? 'admin@devacademy.local';
const PASSWORD = process.env.E2E_PASSWORD ?? 'Admin123!';

describe('Duman testi', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true, permissions: { notifications: 'NO' } });
  });

  it('giriş yapar, bir ders açar ve animasyonu oynatır', async () => {
    // 1) Giriş
    await waitFor(element(by.id('login-screen'))).toBeVisible().withTimeout(30000);
    await element(by.id('login-email')).typeText(EMAIL);
    await element(by.id('login-password')).typeText(PASSWORD);
    await element(by.id('login-submit')).tap();

    // Onboarding gelirse geç
    try {
      await waitFor(element(by.id('onboarding-screen'))).toBeVisible().withTimeout(5000);
      await element(by.id('onboarding-skip')).tap();
    } catch {
      // onboarding daha önce tamamlanmış
    }

    // 2) Modüller sekmesi → ilk modül → ilk ders
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(20000);
    await element(by.id('tab-modules')).tap();
    await waitFor(element(by.id('module-a-system-design-fundamentals'))).toBeVisible().withTimeout(20000);
    await element(by.id('module-a-system-design-fundamentals')).tap();
    await waitFor(element(by.id('module-screen'))).toBeVisible().withTimeout(20000);
    await element(by.id('lesson-a-05-load-balancing')).tap();
    await waitFor(element(by.id('lesson-screen'))).toBeVisible().withTimeout(20000);

    // 3) Animasyon oynatıcısına kaydır ve oynat
    await waitFor(element(by.id('scene-player')))
      .toBeVisible()
      .whileElement(by.type(device.getPlatform() === 'ios' ? 'RCTCustomScrollView' : 'android.widget.ScrollView'))
      .scroll(400, 'down');
    await detoxExpect(element(by.id('scene-step-label'))).toBeVisible();
    await element(by.id('scene-play')).tap();
    // Birkaç adım oynasın; ardından duraklat ve oynatıcının çalıştığını doğrula
    await new Promise((resolve) => setTimeout(resolve, 4000));
    await element(by.id('scene-play')).tap();
    await detoxExpect(element(by.id('scene-canvas'))).toExist();
    await element(by.id('scene-next')).tap();
    await detoxExpect(element(by.id('scene-step-label'))).toBeVisible();
  });
});
