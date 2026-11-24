import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_ENV, STACK, WEB_ENV } from './src/stack';

const ROOT = path.resolve(__dirname, '../..');
const CI = Boolean(process.env.CI);

/**
 * BROWSER BEHAVIOR TESTS (`pnpm test:e2e`, apps/e2e/README.md)
 *
 * Playwright boots the stack in order (emulators → API → production build of the web), runs the specs in
 * `src/` headless, and stops everything. `pnpm test:e2e` builds the API first; Java 21+ is needed for the
 * emulators. The browser is Playwright's Chromium (`pnpm --filter @app/e2e browsers`, once per machine);
 * `E2E_BROWSER_CHANNEL=chrome` uses the installed Google Chrome instead.
 */
export default defineConfig({
    testDir: './src',
    timeout: 90_000,
    expect: { timeout: 15_000 },
    // One stack, one browser at a time: predictable on a laptop and in CI.
    workers: 1,
    fullyParallel: false,
    forbidOnly: CI,
    retries: CI ? 1 : 0,
    reporter: CI
        ? [['github'], ['list'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],
    use: {
        ...devices['Desktop Chrome'],
        baseURL: STACK.web,
        locale: 'en-US',
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: [
        {
            name: 'emulators',
            command: `"${path.join(ROOT, 'node_modules/.bin/firebase')}" emulators:start --config firebase.e2e.json --only auth,firestore --project ${STACK.projectId}`,
            url: `http://${STACK.firestore}`,
            timeout: 180_000,
            reuseExistingServer: !CI,
            stdout: 'ignore',
            stderr: 'pipe',
            gracefulShutdown: { signal: 'SIGINT', timeout: 20_000 },
        },
        {
            name: 'api',
            command: 'node dist/main.js',
            cwd: path.join(ROOT, 'apps/api'),
            env: API_ENV,
            url: `${STACK.api}/account/health`,
            timeout: 60_000,
            reuseExistingServer: !CI,
            stdout: 'ignore',
            stderr: 'pipe',
        },
        {
            name: 'web',
            command: `pnpm exec next build && pnpm exec next start -p ${STACK.webPort}`,
            cwd: path.join(ROOT, 'apps/web'),
            env: WEB_ENV,
            url: `${STACK.web}/health`,
            timeout: 600_000,
            reuseExistingServer: !CI,
            stdout: 'ignore',
            stderr: 'pipe',
        },
    ],
});
