#!/usr/bin/env bash
# Firebase's `predeploy` hook for the Functions codebase (firebase.json). Builds and bundles apps/functions into
# apps/functions/.functions, which is what `firebase deploy` uploads. Keeps the `.env` written by deploy-functions.sh.
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

pnpm turbo run bundle:functions --filter @app/functions --output-logs=errors-only
[[ -f apps/functions/.functions/index.js ]] || fail "The bundle was not produced."
ok "Bundle ready: apps/functions/.functions"
