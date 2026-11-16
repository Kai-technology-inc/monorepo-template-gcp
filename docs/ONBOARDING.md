# Onboarding with an AI agent

This document is written **for a coding agent** (Claude Code, Cursor, Codex, Copilot, Gemini CLI, or a chat
assistant) that takes a person from "I just got this repository" to "my app runs on my own Google Cloud project, and
every release deploys itself". The person should only have to sign in, click a few things in the browser and make
decisions. Everything else is yours.

People: tell your agent **"Set me up"** (in Claude Code: `/onboard`). That is all.

## How to run this

1. **Ask the person's language and answer in it.** This file is English; the conversation does not have to be.
2. **`pnpm doctor --json` is the state.** Never guess where the setup is: run `pnpm doctor --json` (local),
   `pnpm doctor qa --json` or `pnpm doctor prod --json`. It is read-only, takes under a minute, and returns every
   step with `status` (`ok` / `todo` / `blocked`), `owner` (`agent` / `human`) and `next` (the command or the
   instruction). Do the first `todo`, run the doctor again, repeat. Every script is idempotent, so re-running after
   a failure is always safe.
3. **`owner: agent`**: run `next` yourself. Explain in one line what it does before you run it.
4. **`owner: human`**: stop and hand the person exactly one thing to do: what, where (URL), what to click or type,
   and what to tell you when done. Then wait. Do not pile several human steps into one message.
5. **Keep the person oriented**: at the start, and after each phase, say where they are ("Phase 5 of 6: your QA
   environment, 6 of 14 steps done") and what comes next.
6. **Resuming?** If `PROJECT.md` exists, the interview is done: read it, run the doctor, and continue from the first
   `todo`. Do not ask again what is already written there.

### Rules that are not optional

- **Never ask for or handle a password, a one-time code, a payment card, or a key.** Logins are interactive commands
  the person runs (in Claude Code: type `! gcloud auth login` so it runs in the session). This template needs no
  service-account key anywhere; if a step seems to need one, you are on the wrong path: stop and re-read
  `docs/DEPLOY.md`.
- **Ask before anything that costs money or is public**, even when the doctor says `owner: agent`: linking billing,
  creating a GCP project, creating a public repository, cutting a release (`pnpm create-version`), deploying to
  production. Say what will happen and wait for a yes.
- **Nothing is created before the plan is confirmed** (phase 1). If a name turns out to be taken or anything in the
  plan has to change, show the change and confirm again.
- **Production is the person's call.** You may prepare `prod`; a release to it (`gh release create`) and the
  approval in GitHub Actions are done by a person.
- **Don't hand-edit what a script generates** (`.firebaserc`, `apps/web/apphosting.<env>.yaml`): re-run the script.
- **When a command fails**, read its message (the scripts say how to fix themselves), check
  `docs/DEPLOY.md` → Troubleshooting, fix, and re-run. After two failed attempts at the same step, explain what
  you tried and ask the person.

### If you cannot run commands (chat-only assistant)

Same loop, but the person runs the commands. Suggest **Google Cloud Shell**
(https://shell.cloud.google.com): it opens in the browser, is already signed in to Google Cloud and has `gcloud`,
`git` and Node. There they need `npm i -g pnpm`, and `gh` (https://cli.github.com) if missing. Give one command at a
time and ask them to paste back the output of `pnpm doctor <env>` after each step.

## Phase 1: get to know the project and agree on a plan

Before any command that creates something, have a short conversation. Ask **one or two questions at a time**, in
plain words, offer a sensible default for each, and accept "you choose". If the person already said something
(in their first message, or in `PROJECT.md`), do not ask it again.

1. **What is it?** "In a sentence or two: what will this app do, and for whom?" (It becomes the description and the
   context future agents read before building features.)
2. **Name.** The name people will see (e.g. "Acme CRM"). Propose a short id from it: lowercase, digits and dashes,
   ≤ 20 characters (`acme-crm`). It names the repository and the projects.
3. **Languages.** The template speaks English, Spanish and Portuguese. Which ones should it keep, and which one is
   the default for a visitor whose browser asks for none of them?
4. **Where are the users?** It picks the region, and the Firestore region **cannot be changed later**:
   Argentina/Brazil/Chile → `southamerica-east1`; USA or "everywhere" → `us-central1`; Europe → `europe-west1`;
   Mexico → `us-central1` (or `northamerica-south1` if available in their projects).
5. **GitHub.** Their user or an organization? Private (default) or public?
6. **Google account.** Personal or a company's Google Workspace? A company account may need an admin to allow
   project creation or billing; better to know now.
7. **Environments.** QA now and production later (default), or both today? If production: who approves its deploys
   (GitHub usernames)?

Then **show the plan and ask for confirmation**. Fill every value; nothing in angle brackets:

```text
Plan for "Acme CRM"
  What it is      CRM for small agencies: contacts, deals and follow-ups.
  Languages       es (default), en
  Repository      github.com/acme/acme-crm (private), from this template
  QA              Google Cloud project acme-crm-qa, region southamerica-east1
                  web  https://web--acme-crm-qa.southamerica-east1.hosted.app (approx.; App Hosting confirms it)
                  API  https://southamerica-east1-acme-crm-qa.cloudfunctions.net
  Production      acme-crm-prod, later; deploys approved by @ana
  Includes        Firebase Auth (email + password), Firestore, Cloud Functions, App Hosting,
                  GitHub Actions without keys: rc* tag → QA, release → production
  Cost            Blaze (pay-as-you-go) plan; a small app is usually within the free tier. Budget alert suggested.
  You will        sign in to Google, Firebase and GitHub; link billing; connect GitHub to App Hosting (browser)
```

"Nothing has been created yet. Do you want to change anything, or shall I start?" Wait for an explicit yes.

**Check names before using them:** `gh repo view <owner>/<id>` must fail (the name is free). A project id is global
across all of Google Cloud and cannot be checked in advance: if creation fails with "already exists", propose
`<id>-qa-<4 digits>`, and confirm the new name.

**After the yes**, before the infrastructure:

- Write `PROJECT.md` at the root (below) and commit it with the first commit.
- Put the name and description in the UI: `common.appName` and `common.appDescription` in every dictionary of
  `packages/i18n/src/messages/`, translated.
- Languages: set `DEFAULT_LOCALE` in `packages/contracts/src/locale.ts`. To drop a language, remove it from
  `SUPPORTED_LOCALES`, delete its dictionary and its loader in `messages/index.ts`, and its entry in
  `LOCALE_NATIVE_NAMES`; to add one, `docs/I18N.md`. Then `pnpm check`.

```markdown
# <Name>

<What it does and for whom, in the person's words, 2–4 sentences.>

## Decisions

| What                 | Value                              |
| -------------------- | ---------------------------------- |
| Short id             | acme-crm                           |
| Languages            | es (default), en                   |
| Repository           | acme/acme-crm (private)            |
| QA project           | acme-crm-qa (southamerica-east1)   |
| Production           | acme-crm-prod (southamerica-east1) |
| Production approvers | @ana                               |

Created from the monorepo template on <date>. Setup status: `pnpm doctor qa` / `pnpm doctor prod`.
```

Keep it up to date when a decision changes (a project id that had to change, the real web URL once known).

## Phase 2: your own copy

Find out which case you are in (`git remote -v`, `gh repo view --json isTemplate,nameWithOwner`) and say it in one
line. The goal is always the same: **a repository the person owns on GitHub**, with this template as its starting
point, named as the plan says.

| Situation                                                                     | What to do                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing local yet (e.g. chat-only, or a fresh Cloud Shell)                    | `gh repo create <owner>/<name> --template <template-repo> --private --clone && cd <name>`. `<template-repo>` is `Kai-technology-inc/monorepo-template-gcp` (a fork or copy of it may live elsewhere: if `git remote -v` shows another template, use that). |
| Cloned the template itself (`origin` is the template: `isTemplate` is `true`) | Keep it as a second remote for updates and create theirs from this copy: `git remote rename origin template && gh repo create <owner>/<name> --private --source . --remote origin --push`.                                                                 |
| Downloaded a zip (no `.git`)                                                  | `git init -b main && git add -A && git commit -m "chore: start from template"`, then `gh repo create <owner>/<name> --private --source . --remote origin --push`.                                                                                          |
| Already created with GitHub's **Use this template** and cloned                | Nothing: `origin` is theirs.                                                                                                                                                                                                                               |

This needs `gh` logged in (`gh auth login`, run by the person). If they would rather not install `gh` yet, the
browser works too: on the template's GitHub page, **Use this template → Create a new repository**, then clone it.

Never push to the template's repository, and never configure GCP while `origin` is the template: `pnpm doctor qa`
blocks on it (`github-repo`).

## Phase 3: run it locally (≈5 minutes, no account needed)

Goal: the person sees the app working on their machine before touching the cloud.

1. `pnpm doctor --json` → install what is missing (`node`, `pnpm`, `java` are `human`; `pnpm install` is yours).
2. If there is no commit yet: `git init -b main && git add -A && git commit -m "chore: start from template"`.
3. `pnpm check` (every gate should pass on a fresh copy; if not, that is a bug in the template, say so).
4. Start `pnpm dev` in the background and wait until http://localhost:3000 answers.
5. **Human:** "Open http://localhost:3000/auth/register and create an account (any email, it is local: no email is
   sent). You will land on your workspace dashboard. Tell me when you see it." Mention the emulator UI at
   http://127.0.0.1:4000 shows the users and data that were created.
6. Stop `pnpm dev` when moving on.

## Phase 4: accounts and repository

1. `pnpm doctor qa --json`. The first `todo`s are the tools and logins: `gcloud`, `gcloud auth login`,
   `pnpm exec firebase login`, `gh auth login`. One at a time, each run by the person.
   - The Google account they sign in with will own the projects; a company account needs permission to create
     projects in its organization (if `gcloud projects create` fails with a policy error, ask them for an existing
     project id or for their admin to create one).
2. **GitHub repository**: if phase 2 left it for later, do it now (same table). The doctor's `github-repo` step
   is ok only when `origin` is a repository the person administers and not the template.

## Phase 5: the QA environment

1. **Project id and region** from the plan (`<id>-qa`). If the id is taken, propose a suffix, confirm, and update
   `PROJECT.md`. Pass the region with `--region` to every command that takes it.
2. `pnpm setup:gcp <project-id> qa --create --github <owner/repo>`. It stops at **billing** if the project has none:
   - Cloud Functions and App Hosting need the **Blaze** (pay-as-you-go) plan. Tell the person plainly: a small app
     usually stays inside the free tier and costs little or nothing, but a card is required; suggest a **budget
     alert** (https://console.cloud.google.com/billing/budgets).
   - `gcloud billing accounts list`. If there is one, ask which, then with their OK
     `gcloud billing projects link <project-id> --billing-account <ID>`. If there is none, they create it in the
     browser: https://console.cloud.google.com/billing/create (the payment details are theirs to enter, never yours).
   - Re-run the same `pnpm setup:gcp …` command.
3. Commit and push the generated files: `.firebaserc`, `apps/web/apphosting.qa.yaml`.
4. **Human: the App Hosting backend** (it connects Google to GitHub, which needs their browser). Give them one of:

   - Terminal (Claude Code: prefix with `!`):
     `pnpm exec firebase apphosting:backends:create --project <project-id> --backend web --primary-region <region> --root-dir apps/web`
   - Or the console: `https://console.firebase.google.com/project/<project-id>/apphosting` → Create backend.

   Answers: region as above; GitHub repository `<owner/repo>` (authorize the Firebase GitHub app for it when asked);
   root directory `apps/web`; live branch `main`; automatic rollouts **off** if asked; backend id `web`; associate
   the existing web app. It may start a first build: that is fine.

5. `pnpm setup:web qa`: environment name, automatic rollouts off, CORS origin, Auth domain and email links.
6. **First deploy** (ask first, it creates the version tag `rc0.1.1`): `pnpm check`, then
   `pnpm create-version --yes`. Follow it with `gh run watch` (API first, then web; ~10 minutes the first time).
   If a job fails, `gh run view --log-failed`, fix, and re-run the workflow (`gh run rerun <id> --failed`); never
   tag again for the same code.
7. `pnpm doctor qa` should be all green. **Human:** "Open `<web origin>`, register with a real email, and click the
   verification link in your inbox (check spam)."

## Phase 6: production (when the person wants it)

Same as phase 5 with `prod` and a separate project (`<id>-prod`), so QA mistakes never touch production data.
Differences:

- `pnpm doctor prod` adds **required reviewers**: the approvers from the plan; set them in
  `https://github.com/<owner/repo>/settings/environments` → `prod` (private repositories need a paid GitHub plan
  for this; tell the person if theirs does not have it).
- The deploy is a person's act: `gh release create v<version> --target rc<version> --generate-notes` for a version
  that is already in QA, then they approve it in GitHub Actions. Offer the command; do not run it unless they ask you
  to, explicitly, for that release.

## When it is done

Update `PROJECT.md` with the real URLs. Tell the person, in a few lines: their URLs (web QA/prod, API base), how a release works
(`pnpm create-version` → QA, release → prod), where the docs are (`AGENTS.md` first), and that from now on they can
ask you for features: you will follow `docs/EXTENDING.md`.

## Later: updates from the template

If the person kept the `template` remote (or adds it: `git remote add template https://github.com/<template-repo>`),
template improvements come in as a normal merge on a branch: `git fetch template && git switch -c chore/template-update
&& git merge template/main`, resolve, `pnpm check`, pull request. A repository created with `--template` or **Use this
template** starts with unrelated history; add `--allow-unrelated-histories` the first time.

## Reference

| Command                                                | What                                                         | Runs as        |
| ------------------------------------------------------ | ------------------------------------------------------------ | -------------- |
| `pnpm doctor [qa\|prod] [--json]`                      | where the setup is, next step (read-only)                    | agent          |
| `pnpm setup:gcp <project> <env> [flags]`               | project, APIs, Firestore, Auth, web app config, WIF, GH vars | agent          |
| `pnpm setup:web <env>`                                 | backend env name, rollouts off, CORS, Auth domain/links      | agent          |
| `firebase apphosting:backends:create`                  | App Hosting backend connected to GitHub (browser)            | human          |
| `gcloud auth login`, `firebase login`, `gh auth login` | sign-ins                                                     | human          |
| `pnpm create-version --yes`                            | version tag `rc*` → deploys QA                               | agent, with OK |
| `gh release create v…`                                 | deploys production after approval                            | human          |
