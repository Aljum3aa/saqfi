import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Read-only UI checks plus rejected submissions; no demo financial data is changed.
const baseURL = process.env.SAQFI_CHECK_URL || 'http://127.0.0.1:80';
const output = 'generated-artifacts/saqfi-ui';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
const results = [];
const runtimeErrors = [];
const contexts = [];

async function newPage(width, lang = 'ar') {
  const context = await browser.newContext({ baseURL, viewport: { width, height: 850 } });
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.addInitScript(value => localStorage.setItem('saqfi-lang', value), lang);
  return page;
}
async function ready(page, route) {
  await page.goto(route);
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function check(page, name) {
  await page.evaluate(() => Promise.all(
    document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => {}))
  ));
  const measurements = await page.evaluate(() => {
    const width = window.innerWidth;
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width;
    const outside = [...document.querySelectorAll('input,button,a,.panel,[role="dialog"]')]
      .filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > width + 1);
      }).map(e => `${e.tagName}:${e.getAttribute('data-testid') || e.textContent?.slice(0, 40)}`);
    const main = document.querySelector('main');
    const strip = document.querySelector('[data-testid="status-mode"] > div');
    return {
      width, overflow, outside, titleCount: (main || document).querySelectorAll('h1').length,
      bodyFontSize: getComputedStyle(document.body).fontSize,
      font: getComputedStyle(document.body).fontFamily,
      background: getComputedStyle(document.body).backgroundColor,
      hiddenTables: [...document.querySelectorAll('table')].filter(t => t.getBoundingClientRect().width === 0).length,
      visibleText: document.body.innerText,
      title: document.title,
      statusText: strip?.textContent,
      statusWhiteSpace: strip && getComputedStyle(strip).whiteSpace,
    };
  });
  await page.screenshot({ path: `${output}/${name}.jpg`, type: 'jpeg', quality: 75 });
  results.push({ name, ...measurements });
  expect(measurements.overflow, `${name}: page overflow`).toBeLessThanOrEqual(1);
  expect(measurements.outside, `${name}: offscreen controls`).toEqual([]);
  expect(measurements.titleCount, `${name}: one page title`).toBe(1);
  expect(measurements.bodyFontSize).toBe('16px');
  expect(measurements.visibleText, `${name}: no long dashes`).not.toMatch(/[—–]/);
  expect(measurements.title, `${name}: no long dashes in title`).not.toMatch(/[—–]/);
  expect(measurements.visibleText, `${name}: named months, not ISO dates`).not.toMatch(/\b\d{4}-(?:0[1-9]|1[0-2])\b/);
  if (measurements.statusText) {
    expect(measurements.statusText).toMatch(/^(?:المدير المالي|رئيس النادي|لاعب|Finance manager|Club president|Player) · (?:بيانات تجريبية|Demo data)$/);
    expect(measurements.statusWhiteSpace).toBe('nowrap');
  }
}

try {
  for (const width of [375, 1440]) {
    for (const lang of ['ar', 'en']) {
      const page = await newPage(width, lang);
      await page.goto('/');
      await expect(page.getByTestId('button-login-manager')).toBeVisible();
      await check(page, `login-${width}-${lang}`);
      await page.getByTestId('button-login-manager').click();
      await expect(page.getByTestId('text-kpi-budget')).toBeVisible();
      const before = await (await page.request.get('/api/saqfi/state')).json();
      for (const route of ['dashboard', 'budget', 'contracts', 'payroll', 'transactions']) {
        await ready(page, `/${route}`);
        await check(page, `${route}-${width}-${lang}`);
        if (width === 375) await expect(page.getByTestId('nav-mobile')).toBeVisible();
        if (route === 'payroll') {
          await page.locator('[data-testid^="button-toggle-payroll-"]').first().click();
          await check(page, `payroll-expanded-${width}-${lang}`);
          await page.getByTestId('button-run-payroll').click();
          await expect(page.getByRole('alertdialog')).toBeVisible();
          await check(page, `payroll-confirm-${width}-${lang}`);
          await page.keyboard.press('Escape');
        }
        if (route === 'transactions') {
          const september = lang === 'ar' ? 'رواتب اللاعبين، سبتمبر 2026' : 'Player salaries, September 2026';
          const staff = lang === 'ar' ? 'رواتب الجهاز الفني، سبتمبر 2026' : 'Technical staff salaries, September 2026';
          await expect(page.getByText(september, { exact: true }).filter({ visible: true })).toBeVisible();
          await expect(page.getByText(staff, { exact: true }).filter({ visible: true })).toBeVisible();
          if (width === 375) {
            await expect(page.locator('table')).toBeHidden();
            const card = page.locator('[data-testid^="card-tx-"]').first();
            await expect(card).toBeVisible();
            for (const label of lang === 'ar' ? ['التاريخ', 'البند', 'المبلغ'] : ['Date', 'Category', 'Amount'])
              await expect(card.getByText(label, { exact: true })).toBeVisible();
          }
        }
      }
      await page.getByTestId('button-advisor').click();
      await expect(page.getByTestId('dialog-advisor')).toBeVisible();
      await check(page, `advisor-${width}-${lang}`);
      await page.getByTestId('button-close-advisor').click();
      await ready(page, '/budget');
      await page.getByTestId('button-edit-budget').click();
      await check(page, `budget-edit-${width}-${lang}`);
      await page.getByTestId('button-cancel-budget').click();
      await ready(page, '/contracts');
      await page.getByTestId('button-new-contract').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await check(page, `contract-form-${width}-${lang}`);
      await page.getByTestId('input-name').fill('لاعب فحص السقف');
      await page.getByTestId('input-name-en').fill('Cap Check Player');
      await page.getByTestId('input-salary').fill('10000');
      await page.getByTestId('button-submit-contract').click();
      await expect(page.getByTestId('text-api-error')).toBeVisible();
      await check(page, `contract-rejected-${width}-${lang}`);
      await page.keyboard.press('Escape');
      await ready(page, '/transactions');
      await page.getByTestId('button-new-expense').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await check(page, `expense-form-${width}-${lang}`);
      // Select the real travel category, then deliberately exceed its free amount.
      await page.locator('#select-expense-category').click();
      await page.getByRole('option', { name: lang === 'ar' ? 'السفر والمعسكرات' : 'Travel & camps', exact: true }).click();
      await page.getByTestId('input-amount').fill('5000');
      await page.getByTestId('input-description').fill('فحص السقف بدون حفظ');
      await page.getByTestId('button-submit-expense').click();
      await expect(page.getByTestId('text-api-error')).toBeVisible();
      await expect(page.getByTestId('text-api-error')).toContainText('1,800');
      await check(page, `expense-rejected-${width}-${lang}`);
      await page.keyboard.press('Escape');
      const after = await (await page.request.get('/api/saqfi/state')).json();
      for (const key of ['totalBudget', 'categories', 'contracts', 'payrolls', 'transactions'])
        expect(after[key], `${key}: rejection must not change financial data`).toEqual(before[key]);
      // Check role switching through actual UI, not fake client state.
      await page.getByTestId('button-logout').click();
      await expect(page.getByTestId('button-login-president')).toBeVisible();
      await page.getByTestId('button-login-president').click();
      await expect(page.getByTestId('text-kpi-budget')).toBeVisible();
      for (const [route, button] of [
        ['budget', 'button-edit-budget'], ['contracts', 'button-new-contract'],
        ['payroll', 'button-run-payroll'], ['transactions', 'button-new-expense'],
      ]) {
        await ready(page, `/${route}`);
        await expect(page.getByTestId(button)).toHaveCount(0);
      }
      const denied = await page.request.post('/api/saqfi/payroll', { data: { month: '2026-10' } });
      expect(denied.status()).toBe(403);
      await page.getByTestId('button-logout').click();
      await expect(page.getByTestId('button-login-player')).toBeVisible();
      await page.getByTestId('button-login-player').click();
      await expect(page.getByTestId('card-own-contract-player-1')).toBeVisible();
      await check(page, `player-${width}-${lang}`);
      const state = await (await page.request.get('/api/saqfi/state')).json();
      expect(state.contracts).toHaveLength(1);
      expect(state.categories).toHaveLength(0);
      expect(state.payrolls.every(p => p.lines.length === 1)).toBe(true);
      await page.close();
    }
  }
  expect(runtimeErrors).toEqual([]);
  console.log(`PASS: ${results.length} viewport/state checks; Arabic/English; roles and contract cap rejection.`);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ results, runtimeErrors }, null, 2));
  await Promise.all(contexts.map(c => c.close()));
  await browser.close();
}
