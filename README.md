# Monorepo Template for Firebase + Google Cloud

A production-grade starting point for a multi-tenant SaaS on Firebase and Google Cloud: the engineering practices
of a real product, minus the product. Sign-in, workspaces, roles, invitations and a language module are done, so the
first commit you write is your own feature.

- **API**: NestJS on Cloud Functions (2nd gen), one Function per area, Firebase Admin, Firestore.
- **Web**: Next.js 16 (App Router) on Firebase App Hosting, Firebase Auth.
- **Shared contracts**: zod schemas used by both sides for types, request validation and response parsing.
- **Multi-tenant**: an account can belong to many workspaces with `OWNER`/`ADMIN`/`MEMBER` roles and permissions.
- **i18n**: typed dictionaries (English, Spanish, Portuguese), plurals, Intl formatting, no hardcoded UI text.
- **Guardrails**: pnpm + Turborepo, strict TypeScript, ESLint layer rules, architecture tests, Firestore rules tests.
- **CI/CD**: GitHub Actions with Workload Identity Federation (no keys): `rc*` tags deploy to QA, releases to prod.
- **Agent-ready**: `AGENTS.md` index + per-package guides, written to be loaded by coding agents.

## Set up with an AI agent

Start with **Use this template** on GitHub (or just clone or download this repository: the agent turns it into your
own repository).

Open the repository in Claude Code (or Cursor, Codex, any coding agent) and say **"Set me up"** (`/onboard` in
Claude Code). The agent follows [`docs/ONBOARDING.md`](docs/ONBOARDING.md): it runs the app locally, creates your
Google Cloud / Firebase projects, connects GitHub Actions and deploys, and asks you only for what needs a person:
signing in, billing, connecting GitHub in the browser, and the decisions. `pnpm doctor qa` shows where you are at
any moment.

## Quick start (no Google Cloud account needed)

Requirements: Node 22, pnpm 12 (`npm i -g pnpm`), Java 17+ (for the Firestore emulator).

```bash
pnpm install
pnpm dev
```

| What                                | URL                   |
| ----------------------------------- | --------------------- |
| Web                                 | http://localhost:3000 |
| API (Swagger UI at `/docs`)         | http://localhost:3100 |
| Emulator UI (users, Firestore data) | http://127.0.0.1:4000 |

Create an account at http://localhost:3000/auth/register. Everything runs against the Firebase emulators with the
`demo-template` project; data persists in `.emulator-data/` between runs.

## Repository layout

```text
apps/
  web/            Next.js app (routes only; screens live in packages)
  api/            Local API server, architecture specs, Firestore/Storage rules + tests
  functions/      Cloud Functions entry point
packages/
  contracts/      zod schemas: identity, workspaces, roles, errors, routes, locales
  i18n/           dictionaries, translator, formatters, React bindings
  api-core/       auth guard, decorators, persistence, config, errors
  api-workspace/  accounts, workspaces, members, invitations
  api-host/       Nest-on-Functions hosting, CORS, function options
  web-kit/        design tokens, UI primitives, Firebase/HTTP clients, AuthContext
  web-platform/   auth screens, app shell, dashboard, members, settings
  eslint-config/  shared lint rules (layers, no hardcoded text)
docs/             architecture, API, i18n, deploy, extending
scripts/          dev, setup-gcp, configure-wif, deploy, create-version
```

## Everyday commands

```bash
pnpm dev                 # emulators + API + web
pnpm check:changed       # typecheck, lint, tests, architecture — only what changed vs origin/main
pnpm check               # everything
pnpm test:rules          # Firestore rules against the emulator
pnpm functions:emulate   # the real Functions bundle in the emulator
pnpm create-version      # cut a release candidate (tag rcX.Y.Z → deploys QA)
pnpm doctor [qa|prod]    # setup status and the next step
```

## Going to Google Cloud

```bash
pnpm setup:gcp my-app-qa qa --create --github my-org/my-app
```

then create the App Hosting backend and run `pnpm setup:web qa`. The full guide, including production and troubleshooting,
is in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Documentation

- [`AGENTS.md`](AGENTS.md): the rules and where to read more (start here, human or agent)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): layers, request flow, multi-tenancy, why
- [`docs/API.md`](docs/API.md): every endpoint and the Firestore layout
- [`docs/I18N.md`](docs/I18N.md): languages, writing text, adding a language
- [`docs/EXTENDING.md`](docs/EXTENDING.md): adding a feature or a whole module
- [`docs/DEPLOY.md`](docs/DEPLOY.md): GCP setup, CI/CD, releases

## License

[MIT](LICENSE)
