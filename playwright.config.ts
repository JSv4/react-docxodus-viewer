import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4178', trace: 'retain-on-failure' },
  webServer: {
    command: `${process.env.RDV_TEST_PREVIEW ? 'npm run preview' : 'npm run dev'} -- --host 127.0.0.1 --port 4178 --strictPort`,
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: !process.env.CI && !process.env.RDV_TEST_PREVIEW,
    timeout: 60_000,
  },
});
