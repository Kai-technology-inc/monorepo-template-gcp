---
name: onboard
description: Set up this repository end to end with the person — run it locally, create their Google Cloud / Firebase projects, connect GitHub Actions and deploy. Use when the person asks to get started, set up, onboard, configure GCP/Firebase, or deploy for the first time.
---

Follow `docs/ONBOARDING.md` from the top. Ask the person which language they prefer; if `PROJECT.md` exists, resume
from it, otherwise start with phase 1: a short interview about the project and a plan they confirm before anything
is created. Then work phase by phase, using `pnpm run doctor <env> --json` as the source of truth after every step.
