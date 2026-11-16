#!/usr/bin/env bash
# Rolls out the web (Firebase App Hosting) for an environment from a git commit.
#
#   bash scripts/deploy-web.sh qa
#
# App Hosting builds in Cloud Build from the commit (root dir apps/web) and applies apps/web/apphosting.<env>.yaml
# on top of apphosting.yaml, chosen by the backend's environment name. Reads APPHOSTING_BACKEND_ID (default "web")
# and FIREBASE_PROJECT_NUMBER (required with Workload Identity Federation).
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

ENVIRONMENT="$(read_environment "${1:-}")"
PROJECT_ID="$(project_for "$ENVIRONMENT")"
BACKEND_ID="${APPHOSTING_BACKEND_ID:-web}"
CONFIG="apps/web/apphosting.${ENVIRONMENT}.yaml"
COMMIT="${GITHUB_SHA:-$(git rev-parse HEAD)}"

[[ -f "$CONFIG" ]] || fail "Missing $CONFIG. Run 'pnpm setup:gcp $PROJECT_ID $ENVIRONMENT' first."
if grep -q 'REPLACE_ME' "$CONFIG"; then
    fail "$CONFIG still has REPLACE_ME values. Run 'pnpm setup:gcp $PROJECT_ID $ENVIRONMENT' or fill them in."
fi

PROJECT_REF="$PROJECT_ID"
if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
    # firebase-tools with external-account credentials needs the project *number*.
    [[ "${FIREBASE_PROJECT_NUMBER:-}" =~ ^[0-9]+$ ]] || fail "Set FIREBASE_PROJECT_NUMBER (numeric) for WIF deploys."
    PROJECT_REF="$FIREBASE_PROJECT_NUMBER"
fi

log "Rolling out backend '$BACKEND_ID' in $PROJECT_ID ($ENVIRONMENT) from $COMMIT"
pnpm exec firebase apphosting:backends:get "$BACKEND_ID" --project "$PROJECT_REF" >/dev/null ||
    fail "Backend '$BACKEND_ID' not found in $PROJECT_ID. See docs/DEPLOY.md, 'Create the App Hosting backend'."

pnpm exec firebase apphosting:rollouts:create "$BACKEND_ID" \
    --project "$PROJECT_REF" \
    --git-commit "$COMMIT" \
    --force
ok "Rollout finished"
