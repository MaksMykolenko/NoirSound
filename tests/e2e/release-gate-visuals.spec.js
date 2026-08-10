import { expect, test } from '@playwright/test';
import { API_BASE, backendUp } from './_helpers';

const ARTIFACTS = 'artifacts/release-gate-fix';
const LOCALES = ['en', 'uk', 'pl', 'ru'];
const WIDTHS = [360, 390, 768, 1024, 1440];
const THEMES = [
  'noir-pink',
  'midnight-blue',
  'crimson-red',
  'royal-purple',
  'emerald-dark',
  'light-minimal',
  'green-stream',
  'orange-wave',
];

function viewportFor(width) {
  return { width, height: width <= 390 ? 844 : width === 768 ? 1024 : 900 };
}

async function loginAsArtist(page) {
  const login = await page.request.post(`${API_BASE}/auth/login`, {
    data: { email: 'artist@noirsound.com', password: 'password123' },
  });
  expect(login.ok()).toBeTruthy();
}

async function setLocalPreference(page, key, value) {
  if (page.url() === 'about:blank') await page.goto('/');
  await page.evaluate(({ storageKey, storageValue }) => {
    localStorage.setItem(storageKey, storageValue);
  }, { storageKey: key, storageValue: value });
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return (0.2126 * channel(rgb[0])) + (0.7152 * channel(rgb[1])) + (0.0722 * channel(rgb[2]));
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test.describe('Release-gate responsive and theme visuals', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await backendUp(request)), 'Backend not reachable — release visual checks skipped.');
    await loginAsArtist(page);
  });

  test('batch stepper stays separated across all locales and release widths', async ({ page }) => {
    test.setTimeout(120_000);

    for (const locale of LOCALES) {
      await setLocalPreference(page, 'noirsound_language', locale);
      for (const width of WIDTHS) {
        await page.setViewportSize(viewportFor(width));
        await page.goto('/upload/batch');
        const steps = page.getByTestId('batch-upload-steps');
        await expect(steps).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);

        const metrics = await steps.evaluate((nav) => {
          const buttons = [...nav.querySelectorAll('button')];
          const rects = buttons.map((button) => button.getBoundingClientRect());
          return {
            documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
            overlapCount: rects.slice(0, -1).filter((rect, index) => (
              rect.right > rects[index + 1].left + 0.5
            )).length,
            minimumTargetWidth: Math.min(...rects.map((rect) => rect.width)),
          };
        });

        expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
        expect(metrics.overlapCount).toBe(0);
        expect(metrics.minimumTargetWidth).toBeGreaterThanOrEqual(44);

        const screenshotName = locale === 'en' && width === 360
          ? 'batch-upload-360.png'
          : locale === 'uk' && width === 390
            ? 'batch-upload-390.png'
            : locale === 'pl' && width === 768
              ? 'batch-upload-768.png'
              : null;
        if (screenshotName) {
          await page.screenshot({
            path: `${ARTIFACTS}/${screenshotName}`,
            fullPage: false,
            animations: 'disabled',
          });
        }
      }
    }
  });

  test('BrandLogo keeps readable semantic contrast in every concrete theme', async ({ page }) => {
    test.setTimeout(120_000);

    for (const theme of THEMES) {
      await setLocalPreference(page, 'noirsound.theme', theme);
      for (const width of [390, 1440]) {
        await page.setViewportSize(viewportFor(width));
        await page.goto('/');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const wordmark = page.getByTestId('brand-wordmark').filter({ visible: true });
        await expect(wordmark).toHaveCount(1);

        const colors = await wordmark.evaluate((element) => {
          const parseRgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
          const styles = getComputedStyle(document.documentElement);
          const probe = document.createElement('span');
          probe.style.color = styles.getPropertyValue('--ns-bg');
          document.body.appendChild(probe);
          const result = {
            foreground: parseRgb(getComputedStyle(element).color),
            background: parseRgb(getComputedStyle(probe).color),
          };
          probe.remove();
          return result;
        });
        expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);

        const screenshotName = theme === 'light-minimal' && width === 390
          ? 'light-minimal-header-390.png'
          : theme === 'noir-pink' && width === 390
            ? 'noir-pink-header-390.png'
            : theme === 'light-minimal' && width === 1440
              ? 'light-minimal-header-1440.png'
              : null;
        if (screenshotName) {
          await page.screenshot({
            path: `${ARTIFACTS}/${screenshotName}`,
            fullPage: false,
            animations: 'disabled',
          });
        }
      }
    }
  });
});
