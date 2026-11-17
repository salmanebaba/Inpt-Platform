import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:5173',
    trace: 'off',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    {
      name: 'desktop',
      testMatch: 'workflow.spec.ts',
      use: { viewport: { width: 1440, height: 1000 }, browserName: 'chromium' },
    },
    {
      name: 'mobile',
      testMatch: 'mobile.spec.ts',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        browserName: 'chromium',
      },
    },
  ],
});
