# @app/api-host

How a Nest app becomes a Cloud Function, and the setup every Nest instance shares (the local server's and each
Function's).

| File                  | What                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `nest-host.ts`        | `createNestHost`: one entry per Function (route, Swagger title, product modules loaded lazily so each boots only its own)  |
| `http-function.ts`    | `createHttpFunction(host, name, options)`: the `onRequest` Function, public at the network level (the guard authenticates) |
| `function-prefix.ts`  | strips `/<function>` from the URL before Nest sees it, so routes are the same locally and deployed                         |
| `function-options.ts` | options every Function inherits (region, max instances, memory) after loading the deploy's `.env`                          |
| `app.setup.ts`        | `configureApp`: request id, helmet, CORS, the error filter, Swagger at `/docs` outside production                          |
| `cors-policy.ts`      | only `ALLOWED_ORIGINS`, bearer tokens (no cookies), and the headers the web sends                                          |
| `platform-modules.ts` | what every instance carries: Firebase Admin, `Store`, clock, the global auth guard                                         |

## Adding a Function

1. A name in `API_FUNCTIONS` (`packages/contracts/src/api-routes.ts`).
2. An entry in `DEFINITIONS` and an export in `apps/functions/src/index.ts` (`index.spec.ts` checks they match).
3. The same module under the same prefix in `apps/api/src/app.module.ts`, for `pnpm dev`.

Per-Function options (memory, timeout, secrets) go in its `createHttpFunction(host, name, { … })` call. Secrets are
declared with `defineSecret` and mounted only where needed; never in `.env`.

## CORS and the emulators

`pnpm dev` (the local server) applies `cors-policy.ts` exactly as production does: test CORS there. The **Functions
emulator** (`pnpm functions:emulate`) enables firebase-functions' `enableCors` debug feature and answers every
origin, so a foreign origin passing there says nothing about production.
