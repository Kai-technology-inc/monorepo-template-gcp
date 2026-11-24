# @app/e2e

Browser behavior tests. Playwright drives the web like a person (fills forms, clicks, reloads) against the real
local stack (emulators, API, a production build of the web) and checks **behavior**, not only appearance: what the
screen shows, and exactly what the web sends to the API (method, path, body, token) with `page.waitForRequest`.

**A change with a screen ships with a behavior test: what the person does and what the web sends to the API.**

```bash
pnpm --filter @app/e2e browsers   # once per machine: Playwright's Chromium
pnpm test:e2e                     # builds the API, boots the stack, runs the specs headless, stops everything
```

Needs Java 21+ (the emulators) like `pnpm dev`. About half a minute on a laptop once the browser is installed.

## The stack

`playwright.config.ts` starts three servers in order and waits for each (`webServer`):

| Server    | What                                                               | Where                     |
| --------- | ------------------------------------------------------------------ | ------------------------- |
| emulators | Auth and Firestore, `firebase.e2e.json`, project `demo-e2e`, empty | `127.0.0.1:9399`, `:8280` |
| api       | `apps/api/dist/main.js` (built by `pnpm test:e2e`), env `API_ENV`  | `http://localhost:3110`   |
| web       | `next build` into `.next-e2e`, then `next start`, env `WEB_ENV`    | `http://localhost:3010`   |

Ports, project and build folder are their own (`src/stack.ts`), so the tests run next to a `pnpm dev` without
touching its data, and every run starts from empty emulators. The API runs with `FLAGS_ADMIN_WORKSPACE_ID=*`
(honored only in `local`), so a test can flip a flag through the admin route like an operator would.

Outside CI, a server already listening on those ports is reused (`reuseExistingServer`); in CI the run always boots
its own.

## The browser

Playwright's own Chromium (`pnpm --filter @app/e2e browsers`, which is `playwright install chromium`): the version
Playwright was tested with, the same locally and in CI. To use the Google Chrome installed on the machine instead
(nothing to download), run with `E2E_BROWSER_CHANNEL=chrome`. Headless by default; `pnpm --filter @app/e2e exec
playwright test --headed` (or `--ui`) to watch.

## Writing a test

- **Act like the person**: reach elements by role and label (`getByRole('button', { name })`, `getByLabel`), never
  by CSS class. The words come from the English dictionary (`t` in `src/support.ts`), so rewording a label changes
  the dictionary, not the test; the browser runs with `locale: 'en-US'`.
- **Assert what the web sends**: start `page.waitForRequest(toApi('POST', apiRoutes…))` before the click, then check
  `postDataJSON()`, the `authorization` header and the response status. Build paths with `apiRoutes` from the
  contracts, never by hand.
- **Assert what the person sees** after it: the heading, the confirmation, the row that the list reloaded.
- **New people for every test** (`newPerson()`): the emulators keep state for the whole run.
- **Flags**: test both branches; flip the flag with the admin route (`src/flags.spec.ts`).

When a test fails, the HTML report (`playwright-report/`) and the trace (`test-results/…/trace.zip`, open it with
`pnpm --filter @app/e2e exec playwright show-trace <file>`) show every step, request and screenshot. In CI they are
uploaded as the `playwright-report` artifact.

## In CI

The `Browser behavior tests` job of `.github/workflows/pr-checks.yml` runs the same command on every pull request
and on `main`: Java 21, `playwright install --with-deps chromium`, `pnpm test:e2e` (about five minutes). Make it a
required check in the branch protection of `main` once it has proven stable for your team.
