#!/usr/bin/env bash
# Lets GitHub Actions deploy to a project without a single long-lived key: Workload Identity Federation.
#
#   bash scripts/configure-wif.sh <project-id> <qa|prod> <owner/repo>
#
# Creates (idempotently):
#   - a workload identity pool "github" and an OIDC provider restricted to ONE repository (by its numeric id, which
#     survives renames and cannot be reused by someone else's repo);
#   - a deployer service account with exactly the roles `firebase deploy` and App Hosting rollouts need;
#   - the binding that lets that repository (and only it) impersonate the deployer.
# Then sets the GitHub Actions variables the workflows read and creates the GitHub environment (with `gh`, if
# available) or prints what to do.
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

PROJECT_ID="${1:-}"
ENVIRONMENT="$(read_environment "${2:-}")"
REPOSITORY="${3:-}"
[[ -n "$PROJECT_ID" && "$REPOSITORY" == */* ]] || fail "Usage: $0 <project-id> <qa|prod> <owner/repo>"
require_command gcloud "Install the Google Cloud SDK."

POOL_ID="github"
PROVIDER_ID="github"
DEPLOYER_ID="github-deployer"
DEPLOYER="${DEPLOYER_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

if command -v gh >/dev/null 2>&1; then
    REPOSITORY_ID="$(gh api "repos/$REPOSITORY" --jq .id)"
    OWNER_ID="$(gh api "repos/$REPOSITORY" --jq .owner.id)"
else
    REPOSITORY_ID="$(curl -fsS "https://api.github.com/repos/$REPOSITORY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).id)))')"
    OWNER_ID="$(curl -fsS "https://api.github.com/repos/$REPOSITORY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).owner.id)))')"
fi
[[ "$REPOSITORY_ID" =~ ^[0-9]+$ ]] || fail "Could not resolve the id of $REPOSITORY (private repo? install and log in to 'gh')."

log "WIF for $REPOSITORY ($REPOSITORY_ID) → $PROJECT_ID"

if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools create "$POOL_ID" --location=global --display-name="GitHub Actions" \
        --project "$PROJECT_ID" --quiet
fi
ok "Pool $POOL_ID"

PROVIDER_ARGS=(
    --project "$PROJECT_ID" --location=global --workload-identity-pool="$POOL_ID"
    --issuer-uri="https://token.actions.githubusercontent.com"
    --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref"
    --attribute-condition="assertion.repository_owner_id == '${OWNER_ID}' && assertion.repository_id == '${REPOSITORY_ID}'"
    --quiet
)
if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --location=global \
    --workload-identity-pool="$POOL_ID" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" "${PROVIDER_ARGS[@]}"
else
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" --display-name="GitHub" "${PROVIDER_ARGS[@]}"
fi
ok "Provider $PROVIDER_ID (only $REPOSITORY)"

if ! gcloud iam service-accounts describe "$DEPLOYER" --project "$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$DEPLOYER_ID" --display-name="GitHub Actions deployer" \
        --description="Impersonated by GitHub Actions through WIF. No keys." --project "$PROJECT_ID" --quiet
fi
ok "Service account $DEPLOYER"

ROLES=(
    roles/cloudfunctions.admin           # create/update the Functions
    roles/run.admin                      # Functions v2 run on Cloud Run
    roles/iam.serviceAccountUser         # deploy Functions that run as the runtime service account
    roles/artifactregistry.admin         # images + the cleanup policy firebase-tools sets
    roles/cloudbuild.builds.editor       # Functions and App Hosting build in Cloud Build
    roles/eventarc.admin                 # triggers, when you add them
    roles/firebaserules.admin            # Firestore and Storage rules
    roles/datastore.indexAdmin           # Firestore indexes
    roles/firebaseapphosting.admin       # App Hosting rollouts
    roles/firebase.viewer                # firebase-tools reads the project
    roles/secretmanager.viewer           # firebase-tools checks the secrets Functions declare
    roles/serviceusage.serviceUsageConsumer
)
for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOYER" --role="$role" \
        --condition=None --quiet >/dev/null
    ok "$role"
done

gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --project "$PROJECT_ID" \
    --role=roles/iam.workloadIdentityUser \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository_id/${REPOSITORY_ID}" \
    --quiet >/dev/null
ok "$REPOSITORY can impersonate $DEPLOYER"

PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
PREFIX="$(printf '%s' "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')"
declare -a VARIABLES=(
    "${PREFIX}_FIREBASE_PROJECT_ID=$PROJECT_ID"
    "${PREFIX}_FIREBASE_PROJECT_NUMBER=$PROJECT_NUMBER"
    "${PREFIX}_WIF_PROVIDER=$PROVIDER"
    "${PREFIX}_DEPLOY_SERVICE_ACCOUNT=$DEPLOYER"
)
log "GitHub Actions variables"
for pair in "${VARIABLES[@]}"; do
    name="${pair%%=*}"
    value="${pair#*=}"
    if command -v gh >/dev/null 2>&1 && gh variable set "$name" --repo "$REPOSITORY" --body "$value" >/dev/null 2>&1; then
        ok "$name set"
    else
        printf '  %s=%s\n' "$name" "$value"
    fi
done
if command -v gh >/dev/null 2>&1 && gh api -X PUT "repos/$REPOSITORY/environments/$ENVIRONMENT" >/dev/null 2>&1; then
    ok "GitHub environment '$ENVIRONMENT'"
else
    warn "Create the GitHub environment '$ENVIRONMENT': https://github.com/$REPOSITORY/settings/environments"
fi
printf '\n  Also set %s_ALLOWED_ORIGINS (the web origin) and, if not "web", %s_APPHOSTING_BACKEND_ID.\n' "$PREFIX" "$PREFIX"
