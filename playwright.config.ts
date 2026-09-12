import { defineConfig } from '@playwright/test';

const port = process.env.RDV_TEST_PORT || '4178';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `${process.env.RDV_TEST_PREVIEW ? 'npm run preview' : 'npm run dev'} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !process.env.RDV_TEST_PREVIEW,
    timeout: 60_000,
  },
});
