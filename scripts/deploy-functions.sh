#!/usr/bin/env bash
# Deploys the API (Cloud Functions) plus Firestore rules/indexes and Storage rules to an environment.
#
#   bash scripts/deploy-functions.sh qa            # project from .firebaserc alias "qa"
#   FIREBASE_PROJECT_ID=my-app-qa bash scripts/deploy-functions.sh qa
#
# Reads: ALLOWED_ORIGINS (required: the web's origin, e.g. https://my-app-qa--my-app-qa.us-central1.hosted.app),
# FUNCTIONS_REGION (default us-central1), FUNCTIONS_MAX_INSTANCES (default 10),
# AUTH_REQUIRE_VERIFIED_EMAIL (default true).
# Auth: in CI, Workload Identity Federation (GOOGLE_APPLICATION_CREDENTIALS set by google-github-actions/auth);
# locally, your `firebase login` session.
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

ENVIRONMENT="$(read_environment "${1:-}")"
PROJECT_ID="$(project_for "$ENVIRONMENT")"
[[ -n "${ALLOWED_ORIGINS:-}" ]] || fail "Set ALLOWED_ORIGINS to the web origin(s) of $ENVIRONMENT (comma separated)."

log "Deploying the API to $PROJECT_ID ($ENVIRONMENT) from $(git rev-parse --short HEAD)"

bash scripts/bundle-for-deploy.sh

# firebase-tools discovers the Functions by running the bundle with a clean environment: the only deploy-time
# configuration it sees is this .env. It is not committed (.gitignore) and is rewritten on every deploy.
cat > apps/functions/.functions/.env <<ENV
APP_ENVIRONMENT=$ENVIRONMENT
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
AUTH_REQUIRE_VERIFIED_EMAIL=${AUTH_REQUIRE_VERIFIED_EMAIL:-true}
FUNCTIONS_REGION=${FUNCTIONS_REGION:-us-central1}
FUNCTIONS_MAX_INSTANCES=${FUNCTIONS_MAX_INSTANCES:-10}
ENV
ok "Wrote apps/functions/.functions/.env"

pnpm exec firebase deploy \
    --only functions,firestore:rules,firestore:indexes,storage \
    --project "$PROJECT_ID" \
    --force \
    --non-interactive

REGION="${FUNCTIONS_REGION:-us-central1}"
log "Health checks"
for fn in account workspaces; do
    url="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${fn}/health"
    for attempt in 1 2 3 4 5; do
        if curl -fsS "$url" >/dev/null; then
            ok "$url"
            break
        fi
        [[ $attempt == 5 ]] && fail "$url did not answer 200"
        sleep 5
    done
done
