import { test, expect } from '@playwright/test';

const ABSTENTION = "I don't have information about that in the help centre.";

test('answerable question renders an answer with a citation link', async ({ page }) => {
  await page.goto('/');
  await page.fill('#question', 'What is the refund policy?');
  await page.click('button[type="submit"]');
  await expect(page.locator('#answer')).toContainText('30-day');
  const citation = page.locator('#citations a[href="/docs/refunds"]');
  await expect(citation).toBeVisible();
  await expect(citation).toHaveText('refunds');
});

test('unanswerable question renders the abstention, with no citations', async ({ page }) => {
  await page.goto('/');
  await page.fill('#question', 'Do you offer a dark mode?');
  await page.click('button[type="submit"]');
  await expect(page.locator('#answer')).toHaveText(ABSTENTION);
  await expect(page.locator('#citations a')).toHaveCount(0);
});

test('citation link opens the source document', async ({ page }) => {
  await page.goto('/');
  await page.fill('#question', 'What is the refund policy?');
  await page.click('button[type="submit"]');
  await page.click('#citations a[href="/docs/refunds"]');
  await expect(page).toHaveURL(/\/docs\/refunds$/);
  await expect(page.locator('body')).toContainText('money-back guarantee');
});

test('/api/ask contract: shape, valid citations, 400 on empty question', async ({ request }) => {
  const ok = await request.post('/api/ask', {
    data: { question: 'How long does a password reset link last?' },
  });
  expect(ok.status()).toBe(200);
  const body = (await ok.json()) as {
    answer: string;
    citations: string[];
    retrieved: string[];
  };
  expect(typeof body.answer).toBe('string');
  expect(body.answer).toContain('1 hour');
  expect(body.citations).toEqual(['password-reset']);
  expect(body.retrieved.length).toBeGreaterThan(0);
  for (const id of body.retrieved) expect(id).toMatch(/^[a-z0-9-]+#\d+$/);

  const bad = await request.post('/api/ask', { data: { question: '  ' } });
  expect(bad.status()).toBe(400);
});
