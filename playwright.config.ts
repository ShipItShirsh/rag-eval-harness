import { defineConfig } from '@playwright/test';

/**
 * The thin browser layer: the app is also a web app, so its user-visible
 * behaviour gets the same treatment as any web app — a few end-to-end
 * tests against the real server. The deep quality checks live in the
 * eval suite (evals/), not here.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3100',
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3100/health',
    env: { PORT: '3100' },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
