# Monorepo template

A NestJS API on Cloud Functions (`apps/api`, `apps/functions`), a Next.js web on Firebase App Hosting (`apps/web`), the
shared model (`packages/contracts`) and the language module (`packages/i18n`), in one repository. One commit carries
contract, API and web; an `rc*` tag is a version and deploys to QA; a GitHub Release `v*` deploys to production.

**This file is an index on purpose**: every agent session loads it whole. Adding to it is one line; anything that
needs explaining goes in the document the line points to. Each package has its own `AGENTS.md` or `README.md`.

| If you are going to…                                     | Read                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| know what this product is and the decisions made for it  | `PROJECT.md` (written at onboarding; if missing, the repo is still a bare template)   |
| understand the layers and why they exist                 | `docs/ARCHITECTURE.md`                                                                |
| add a feature or a whole module (contract → API → web)   | `docs/EXTENDING.md`                                                                   |
| add or change an endpoint                                | `docs/API.md` (keep it in sync), `packages/api-workspace/README.md`                   |
| touch auth, sessions, persistence, config or errors      | `packages/api-core/README.md`                                                         |
| touch how Functions are hosted (options, CORS, prefixes) | `packages/api-host/README.md`, `apps/functions/src/index.ts`                          |
| add UI text, a language, or format dates/numbers         | `docs/I18N.md`                                                                        |
| touch the shared model (schemas, roles, error codes)     | `packages/contracts/AGENTS.md`                                                        |
| touch the web shell, auth screens or kit primitives      | `packages/web-kit/README.md`, `packages/web-platform/README.md`, `apps/web/README.md` |
| change Firestore rules or indexes                        | `apps/api/firestore.rules` and its specs in `apps/api/src/firestore-rules/`           |
| set up a GCP project, CI/CD or deploy                    | `docs/DEPLOY.md`                                                                      |
| take a person through first-time setup ("set me up")     | `docs/ONBOARDING.md` — the state is `pnpm doctor [qa\|prod] --json`                   |

## Rules that are not optional

- **Layers.** contracts → (i18n) → api-core → api-workspace → api-host → apps. Web packages import contracts, i18n and
  web-kit, never `@app/api-*`. ESLint flags it in the editor; `pnpm test:arch` fails CI.
- **No UI text in code.** Every string a person reads comes from `packages/i18n/src/messages/*` through `t()` or
  `<RichText>`, in every supported language. ESLint (`react/jsx-no-literals`) and the parity spec enforce it.
- **The API never sends UI text.** Errors carry a `code` from `ERROR_CODES`; the web translates it.
- **URLs are English kebab-case** in API routes, web routes and query params, whatever language the screen speaks.
- **Contracts are the source of truth.** Request and response shapes are zod schemas in `@app/contracts`; the API
  validates bodies with them and the web parses responses with them.
- **The client never writes to Firestore.** Rules deny all writes; the API writes with the Admin SDK.

## Tools

- **Node 22 and pnpm 12** (`npm i -g pnpm`). Java 21+ for the Firebase emulators.
- **pnpm is strict:** what a package imports must be in its own `package.json`. Shared versions live in the catalog
  of `pnpm-workspace.yaml` (`"catalog:"`), exact. A new dependency with an install script stops `pnpm install` until
  it is listed in `allowBuilds` with `true`/`false` and the reason.
- **Turborepo** runs tasks per package and caches what did not change. During a session:
  `pnpm check:changed` (typecheck, lint, test, test:arch of what changed since `origin/main` and its dependents).
  One package: `pnpm turbo run test --filter=@app/api-workspace`. Before a release: `pnpm check`.
- **App Hosting installs with `pnpm install --prod`:** everything `next build` needs goes in `dependencies` of the web
  packages, not `devDependencies`.
- **`next` has an explicit version in `apps/web/package.json`**, never `catalog:` (App Hosting reads that field).

## Run it

```bash
pnpm install
pnpm dev          # emulators + API (:3100) + web (:3000). No GCP account needed.
pnpm check        # every gate
```

## Deploy

```bash
pnpm check
pnpm create-version --yes                 # tags rcX.Y.Z → GitHub Actions deploys QA (API first, then web)
gh release create vX.Y.Z --target rcX.Y.Z --generate-notes   # a person, after QA → production
```

Never create tags other than `rc*` (QA) and `v*` (production). Details, first-time setup and troubleshooting:
`docs/DEPLOY.md`.
