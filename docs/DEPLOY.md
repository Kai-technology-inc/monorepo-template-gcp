# Deploy

Prefer to be guided? Ask a coding agent to "set me up": it follows [`ONBOARDING.md`](ONBOARDING.md). At any point,
`pnpm doctor qa` (or `prod`) lists what is done and the next step.

Two Google Cloud projects (QA and production), each with Firebase. The API deploys to Cloud Functions, the web to
Firebase App Hosting, and GitHub Actions does both, authenticated with Workload Identity Federation: there is no
service-account key anywhere.

```text
pnpm create-version  ─►  tag rcX.Y.Z  ─►  deploy-qa.yml   ─►  QA:   API (Functions + rules + indexes), then web
gh release create vX.Y.Z --target rcX.Y.Z  ─►  deploy-prod.yml ─►  prod: same, after an approval
```

## First-time setup (once per environment)

Prerequisites: a GitHub repository created from this template, `gcloud` and `gh` logged in
(`gcloud auth login`, `gh auth login`), `pnpm exec firebase login`, and a billing account (Cloud Functions and App
Hosting need the Blaze plan).

### 1. Project, APIs, Firestore, Auth, web app config, WIF

```bash
pnpm setup:gcp my-app-qa qa --create --github my-org/my-app
```

Idempotent; see the header of `scripts/setup-gcp.sh` for each step. It writes `apps/web/apphosting.qa.yaml` (public
Firebase config + API URL) and the `qa` alias in `.firebaserc`, and sets the GitHub variables
`QA_FIREBASE_PROJECT_ID`, `QA_FIREBASE_PROJECT_NUMBER`, `QA_WIF_PROVIDER`, `QA_DEPLOY_SERVICE_ACCOUNT`.

Commit the two generated files.

### 2. Create the App Hosting backend

The one step that needs a browser (to connect GitHub):

```bash
pnpm exec firebase apphosting:backends:create --project my-app-qa \
    --backend web --primary-region us-central1 --root-dir apps/web
```

Connect it to your repository (root directory `apps/web`, live branch `main`). Then:

### 3. Connect the web to the rest

```bash
pnpm setup:web qa
```

It sets the backend's **environment name** to `qa` (so builds read `apps/web/apphosting.qa.yaml`), turns
**automatic rollouts off** (deploys come from tags), adds the backend URL to the GitHub variable `QA_ALLOWED_ORIGINS`
(the API's CORS list), adds its domain to Firebase Auth's **authorized domains**, and points Auth's emails
(verification, password reset) at `https://<web domain>/auth/action`, so they open the template's translated screens.
Any step it cannot do prints the console path to do it by hand. For a custom domain, add it to the variable and to
the authorized domains too.

### 4. GitHub environments

`setup:gcp --github` creates the environment (`qa`, `prod`) in GitHub. On `prod`, add **required reviewers**
(Settings → Environments → prod): every production deploy then waits for a second person.

Repeat 1–4 with `prod` for production.

## Every release

```bash
pnpm check                      # every gate, on a clean, up-to-date main
pnpm create-version --yes       # bumps the version, commits, tags rcX.Y.Z, pushes
```

`deploy-qa.yml` runs on the tag: a gate (typecheck + architecture), then the API (`scripts/deploy-functions.sh qa`:
bundle, `.env`, `firebase deploy --only functions,firestore,storage`, health checks), then the web
(`scripts/deploy-web.sh qa`: an App Hosting rollout of that exact commit). The web goes after the API because a new
screen may call a route the old API does not have.

When QA looks right:

```bash
gh release create v0.1.7 --target rc0.1.7 --generate-notes
```

`deploy-prod.yml` deploys that tag to production after the `prod` environment's approval.

**The tag is the version, not the deploy.** If a deploy fails, do not tag again: fix it, then re-run the failed
workflow, or run `deploy-qa.yml` manually with the same tag.

## Deploying from your machine

Same scripts, with your own `firebase login` session:

```bash
ALLOWED_ORIGINS=https://web--my-app-qa.us-central1.hosted.app bash scripts/deploy-functions.sh qa
bash scripts/deploy-web.sh qa
```

## Configuration reference

| Where                                | Name                                                                                                               | Meaning                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| GitHub variable                      | `{QA,PROD}_FIREBASE_PROJECT_ID`                                                                                    | project id                                                                         |
| GitHub variable                      | `{QA,PROD}_FIREBASE_PROJECT_NUMBER`                                                                                | numeric project number (firebase-tools needs it with WIF)                          |
| GitHub variable                      | `{QA,PROD}_WIF_PROVIDER`                                                                                           | `projects/<number>/locations/global/workloadIdentityPools/github/providers/github` |
| GitHub variable                      | `{QA,PROD}_DEPLOY_SERVICE_ACCOUNT`                                                                                 | `github-deployer@<project>.iam.gserviceaccount.com`                                |
| GitHub variable                      | `{QA,PROD}_ALLOWED_ORIGINS`                                                                                        | the web origin(s), comma separated                                                 |
| GitHub variable                      | `{QA,PROD}_APPHOSTING_BACKEND_ID`                                                                                  | optional, default `web`                                                            |
| GitHub variable                      | `FUNCTIONS_REGION`                                                                                                 | optional, default `us-central1`                                                    |
| GitHub var/secret                    | `TURBO_API`, `TURBO_TEAM` / `TURBO_TOKEN`                                                                          | optional Turborepo remote cache                                                    |
| `apps/web/apphosting.<env>.yaml`     | `NEXT_PUBLIC_*`                                                                                                    | public Firebase config and the API base URL                                        |
| Functions `.env` (written at deploy) | `APP_ENVIRONMENT`, `ALLOWED_ORIGINS`, `AUTH_REQUIRE_VERIFIED_EMAIL`, `FUNCTIONS_REGION`, `FUNCTIONS_MAX_INSTANCES` | API runtime config                                                                 |

**Secrets** (API keys of providers you add) go in Secret Manager: `firebase functions:secrets:set NAME`, declared with
`defineSecret` in `packages/api-host/src/function-options.ts` and mounted only on the Functions that need them. Never
in `.env`, `apphosting.*.yaml` or GitHub variables.

## What the deployer can do

`scripts/configure-wif.sh` creates `github-deployer` with only what `firebase deploy` and App Hosting rollouts need
(Functions, Cloud Run, Cloud Build, Artifact Registry, rules, indexes, App Hosting), and only your repository —
matched by its numeric id, which survives renames and cannot be reused — can impersonate it.

## Troubleshooting

| Symptom                                                                            | Cause                                             | Fix                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Missing GitHub variable for …`                                                    | Step 1 or 3 not done for that environment         | run `setup:gcp` / set the variable                                                                    |
| `Unable to impersonate` / `Permission 'iam.serviceAccounts.getAccessToken' denied` | The workflow runs from a fork or another repo     | WIF only trusts your repo id; re-run `configure-wif.sh` after transferring a repo                     |
| Web build fails with `REPLACE_ME`                                                  | `apphosting.<env>.yaml` not generated             | `pnpm setup:gcp <project> <env>` and commit the file                                                  |
| Web loads but every call fails with CORS                                           | `ALLOWED_ORIGINS` does not include the web origin | set `{ENV}_ALLOWED_ORIGINS` and redeploy the API                                                      |
| Sign-in fails with `auth/unauthorized-domain`                                      | Web domain not authorized in Firebase Auth        | add it in Authentication → Settings                                                                   |
| `403 EMAIL_NOT_VERIFIED` right after sign-up                                       | Expected: verification is required in qa/prod     | open the link in the email; set `AUTH_REQUIRE_VERIFIED_EMAIL=false` only if you really do not want it |
| App Hosting build: `Cannot find module 'typescript'` (or a `@types/*`)             | It is in `devDependencies`                        | move it to `dependencies` (App Hosting installs with `--prod`)                                        |
