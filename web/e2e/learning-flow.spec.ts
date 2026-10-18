import { expect, test } from '@playwright/test';

/** Temel öğrenme akışı: ana sayfa → modül → ders → animasyon → quiz; kayıt → onboarding → pano */

test('ana sayfa modülleri ve hero animasyonunu gösterir', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Oynat|Play/ }).first()).toBeVisible();
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

test('kayıt → onboarding → pano', async ({ page }) => {
  const email = `pw_${Date.now()}@test.local`;
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
});

test('arama sonuç döndürür', async ({ page }) => {
  await page.goto('/search?q=round-robin');
  await expect(page.getByRole('link', { name: /Load Balancer/ }).first()).toBeVisible();
});
