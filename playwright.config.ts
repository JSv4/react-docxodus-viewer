import { defineConfig } from '@playwright/test';

const port = process.env.RDV_TEST_PORT || '4178';
const baseURL = `http://127.0.0.1:${port}`;
const preview = !!process.env.RDV_TEST_PREVIEW;

export default defineConfig({
  testDir: './tests/browser',
  // The source-only API harness is intentionally absent from the demo build.
  testMatch: preview ? ['**/studio.spec.ts', '**/modules.spec.ts', '**/workspace.spec.ts'] : undefined,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `${preview ? 'npm run preview' : 'npm run dev'} -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !preview,
    timeout: 60_000,
  },
});
