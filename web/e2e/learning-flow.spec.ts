import { expect, test } from '@playwright/test';

/** Temel öğrenme akışı: ana sayfa → modül → ders → animasyon → quiz; kayıt → onboarding → pano */

// Her testte: yakalanmamış sayfa hatası ya da React hydration/render hatası testi düşürür
const FATAL_CONSOLE = /hydrat|did not match|Minified React error|server rendered HTML|Uncaught/i;
const pageErrors = new WeakMap<object, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && FATAL_CONSOLE.test(msg.text()))
      errors.push(`console: ${msg.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test('ana sayfa modülleri ve hero animasyonunu gösterir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Vitrin otomatik oynar: oynat ya da duraklat düğmesi görünür
  await expect(
    page.getByRole('button', { name: /Oynat|Play|Duraklat|Pause/ }).first(),
  ).toBeVisible();
  await expect(page.getByText('Sistem Tasarımı Temelleri').first()).toBeVisible();
});

test('ders sayfası: animasyon oynatılır, adımlar ilerler', async ({ page }) => {
  await page.goto('/lessons/a-05-load-balancing');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Load Balancer');
  const player = page.getByRole('figure', { name: /Round-Robin ile/ });
  await player.getByRole('button', { name: 'Adım ileri' }).click();
  await expect(player.getByText(/Adım 2\/5/)).toBeVisible();
  // Diyagram inline SVG olarak çizilir
  await expect(page.locator('.diagram-svg svg').first()).toBeVisible();
});

test('load balancer simülatörü istekleri dağıtır', async ({ page }) => {
  await page.goto('/lessons/a-05-load-balancing');
  const sendBtn = page.getByRole('button', { name: 'İstek gönder' });
  await sendBtn.scrollIntoViewIfNeeded();
  await sendBtn.click();
  await expect(page.getByText(/Round-robin sıradaki: s1/)).toBeVisible();
});

test('kayıt → onboarding → pano', async ({ page }, testInfo) => {
  // Projeler (masaüstü/mobil) paralel koşar: aynı milisaniyede aynı e-posta çakışmasın
  const email = `pw_${testInfo.project.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
  await page.goto('/register');
  await page.getByLabel('Ad soyad').fill('Playwright Kullanıcı');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill('Sifre1234!');
  await page.getByRole('button', { name: 'Kayıt ol' }).last().click();
  await expect(page).toHaveURL(/onboarding/);
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Kaydet ve başla' }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('Tamamlanma')).toBeVisible();
  // Oturum localStorage'dayken tam sayfa yükleme: sunucu ve ilk istemci render'ı eşleşmeli (hydration)
  await page.goto('/lessons/a-05-load-balancing');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Load Balancer');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Load Balancer');
  // Token'lar localStorage'da değil (refresh httpOnly çerezde); yeni sayfa yüklemesinde oturum çerezle sürer
  const stored = await page.evaluate(() => localStorage.getItem('da-auth') ?? '');
  expect(stored).not.toMatch(/accessToken|refreshToken/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText('Tamamlanma')).toBeVisible();
});

test('arama sonuç döndürür', async ({ page }) => {
  await page.goto('/search?q=round-robin');
  await expect(page.getByRole('link', { name: /Load Balancer/ }).first()).toBeVisible();
});

test('CSP başlığı var ve ders sayfası (kod, diyagram, animasyon) ihlalsiz çalışır', async ({
  page,
}) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
  });
  const res = await page.goto('/lessons/a-05-load-balancing');
  const csp = res?.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'self'");
  await expect(page.locator('.diagram-svg svg').first()).toBeVisible();
  const player = page.getByRole('figure', { name: /Round-Robin ile/ });
  await player.getByRole('button', { name: 'Adım ileri' }).click();
  // Shiki (WASM) vurgulaması CSP altında çalışmalı: düz <pre> yerini .shiki çıktısına bırakır
  await page
    .locator('pre')
    .first()
    .evaluate((el) => el.scrollIntoView());
  await expect(page.locator('pre.shiki').first()).toBeVisible({ timeout: 15_000 });
  expect(violations).toEqual([]);
});

test('komut paleti açılır ve ders bulur', async ({ page }) => {
  await page.goto('/');
  // Masaüstünde ⌘K, mobilde başlıktaki arama düğmesi; ikisi de aynı paleti açar
  await page.getByRole('button', { name: 'Ara', exact: true }).first().click();
  const box = page.getByRole('combobox', { name: 'Ara' });
  await expect(box).toBeVisible();
  await box.fill('round-robin');
  await expect(page.getByRole('option', { name: /Load Balancer/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
});

test('modül sayfası: başlık, içerik özeti ve ilk derse başla', async ({ page }) => {
  await page.goto('/modules/a-system-design-fundamentals');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sistem Tasarımı Temelleri');
  await expect(page.getByText(/animasyon/).first()).toBeVisible();
  await page.getByRole('link', { name: /İlk derse başla/ }).click();
  await expect(page).toHaveURL(/\/lessons\/a-01/);
});

test('öğrenme yolu sayfası modülleri sıralı listeler', async ({ page }) => {
  await page.goto('/paths/backend');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Backend');
  await expect(page.getByRole('link', { name: /Sistem Tasarımı Temelleri/ }).first()).toBeVisible();
});

test('oturumlu kullanıcı: ayarlar, geçmiş ve kütüphane sayfaları açılır', async ({
  page,
}, testInfo) => {
  const email = `pw2_${testInfo.project.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.local`;
  await page.goto('/register');
  await page.getByLabel('Ad soyad').fill('Playwright Ayarlar');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill('Sifre1234!');
  await page.getByRole('button', { name: 'Kayıt ol' }).last().click();
  await expect(page).toHaveURL(/onboarding/);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ayarlar');
  await expect(page.getByLabel('Ad soyad')).toHaveValue('Playwright Ayarlar');
  await page.getByLabel('Ad soyad').fill('Playwright Yeni Ad');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByText('Ayarlar kaydedildi')).toBeVisible();

  await page.goto('/history');
  await expect(page.getByText('Henüz quiz çözmedin.')).toBeVisible();

  await page.goto('/library');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kütüphane');
  await expect(page.getByText('Henüz bir şey yok.').first()).toBeVisible();
});
