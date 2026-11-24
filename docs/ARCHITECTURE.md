# Architecture

## The pieces

```text
apps/
  web/              Next.js 16 (App Router) on Firebase App Hosting. Thin routes that render screens from packages.
  api/              The local API server (NestJS on Express), the AppModule, the architecture specs and the
                    Firestore/Storage rules with their tests.
  functions/        The Cloud Functions entry: one HTTP Function per API area (`account`, `workspaces`).
  e2e/              Browser behavior tests (Playwright) against emulators + API + web on their own ports.
packages/
  contracts/        Layer 0. zod schemas and types shared by API and web: identity, workspaces, roles, errors, routes,
                    and the declared feature flags.
  i18n/             The language module: typed dictionaries, translator, Intl formatters, React bindings.
  api-core/         Layer 1 of the API: Firebase Admin, the auth guard and decorators, persistence, config, errors,
                    and the feature-flags port with its adapters (Firestore, LaunchDarkly, Remote Config, memory).
  api-workspace/    Layer 2: accounts, workspaces, members, invitations, health.
  api-host/         How a Nest app becomes a Cloud Function: bootstrap per Function, prefix stripping, CORS, options.
  web-kit/          Web primitives: design tokens, UI components, Firebase client, HTTP client, AuthContext.
  web-platform/     The product's screens: auth, app shell, dashboard, members, settings.
  eslint-config/    Shared lint rules, including the layer guard and "no hardcoded UI text".
```

## Layers

```text
                ┌─────────────┐
                │  contracts  │  imports nothing from the workspace
                └──────┬──────┘
         ┌─────────────┼───────────────────────┐
         ▼             ▼                       ▼
     ┌───────┐   ┌──────────┐            ┌──────────┐
     │ i18n  │   │ api-core │            │ web-kit  │◄── i18n
     └───────┘   └────┬─────┘            └────┬─────┘
                      ▼                       ▼
              ┌───────────────┐        ┌──────────────┐
              │ api-workspace │        │ web-platform │
              └──────┬────────┘        └──────┬───────┘
                     ▼                        ▼
              ┌───────────┐              ┌─────────┐
              │ api-host  │              │ apps/web│
              └─────┬─────┘              └─────────┘
                    ▼
          apps/api · apps/functions
```

Each package may import only what is below it. This is what lets a module grow without dragging the rest along,
and it is checked twice: by ESLint in the editor (`no-restricted-imports`, from each package's
`eslint.config.mjs`) and by `apps/api/src/arch/layers.spec.ts` in CI, which cannot be silenced with a comment.

Web and API never import each other: they meet in the contracts, over HTTP.

## A request, end to end

1. The web signs in with Firebase Auth (client SDK) and gets an ID token.
2. `callApi()` (`web-kit`) sends `Authorization: Bearer <token>` and `X-Request-Id` to
   `NEXT_PUBLIC_API_BASE_URL + apiRoutes.…()`.
3. Deployed, the URL hits the Cloud Function named after the first segment (`account`, `workspaces`).
   `createHttpFunction` strips that prefix and hands the request to a Nest app created once per container with only
   that area's modules. Locally, `apps/api` mounts the same modules under the same prefixes, so paths are identical.
4. `FirebaseAuthGuard` (global) verifies the token, loads `users/{uid}` and, for `/workspaces/:workspaceId/…`, the
   caller's membership in that workspace. `@RequirePermission()` checks the role's permissions.
5. The body is parsed with the contract's zod schema. The service runs the business rule, writing to Firestore in a
   transaction when more than one document must change together.
6. The response is a contract type. Errors are `ApiErrorBody` with a `code`; the web translates it.

Feature flags follow the same path: the API evaluates them (`FlagsProvider`, `FLAGS_PROVIDER` picks the adapter) and
sends their values in the session; the web reads them with `useFlag(key)` and never talks to a flags provider
(`docs/FLAGS.md`).

## Multi-tenancy

A **workspace** is a tenant. A person (Firebase identity + `users/{uid}`) can belong to many workspaces with a role
in each (`OWNER`, `ADMIN`, `MEMBER`); `activeWorkspaceId` is the one they are working in. Product data you add
should live under `workspaces/{workspaceId}/…`, and its routes under `/workspaces/:workspaceId/…`, so the guard's
membership check protects it for free.

Roles are bundles of **permissions** (`ROLE_PERMISSIONS` in `contracts/src/roles.ts`). Code checks permissions,
never roles: the API with `@RequirePermission('members:manage')`, the web with `can('members:manage')`.

## Data access

The browser never writes to Firestore: `firestore.rules` deny every write, and reads are limited to a person's own
profile and the workspaces they belong to (useful for realtime listeners if you add them). All writes go through the
API, which is where validation, permissions and multi-document invariants live.

## Environments

| Environment | Project                          | API                 | Web                 | Deployed by                                             |
| ----------- | -------------------------------- | ------------------- | ------------------- | ------------------------------------------------------- |
| local       | `demo-template` (emulators only) | `pnpm dev` on :3100 | `pnpm dev` on :3000 | —                                                       |
| qa          | your QA project                  | Cloud Functions     | App Hosting         | tag `rc*` → `deploy-qa.yml`                             |
| prod        | your production project          | Cloud Functions     | App Hosting         | GitHub Release `v*` → `deploy-prod.yml` (with approval) |

Separate projects per environment mean separate Auth users, data and IAM: a QA mistake cannot touch production.

## Why these choices

- **One repository.** A contract change, the API that serves it and the screen that uses it ship in one commit and
  one review. No version skew between packages, no publishing.
- **zod contracts.** One definition gives the TypeScript type, the API's request validation and the web's response
  parsing. Drift between API and web becomes a type error.
- **NestJS on Functions, one Function per area.** Nest gives modules, DI and guards; one Function per area keeps cold
  starts small and lets each scale and be configured (memory, secrets) on its own. The local server mounts all of them
  together for a fast development loop.
- **App Hosting for Next.** Server rendering, CDN and builds from git with no infrastructure to manage, and the same
  Firebase project as the API.
- **Architecture specs.** Conventions written only in documents erode. Every rule here that can be checked by a test
  is.
- **Flags behind a port.** Which flags tool a product uses is a business decision that changes; the code depends on
  `FlagsProvider` and one shared spec every adapter passes, so switching is configuration, not a rewrite.
- **Behavior tests in a browser.** Unit specs prove the rules and the API e2e the wiring; only a browser proves that
  what a person does sends the right request and shows the right result (`apps/e2e`).
