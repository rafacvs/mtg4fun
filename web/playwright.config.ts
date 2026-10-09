import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  fullyParallel: true,
  reporter: 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    { name: 'celular-horizontal', use: { ...devices['Pixel 7 landscape'] } },
  ],
});
