#!/usr/bin/env bash
# Prepares a Google Cloud / Firebase project for one environment of this template. Idempotent: run it again any
# time; it only creates what is missing.
#
#   pnpm setup:gcp <project-id> <qa|prod> [--create] [--region us-central1] [--github owner/repo]
#
# What it does:
#   1. (--create) creates the GCP project and adds Firebase to it. Billing must be linked (Blaze plan) for Cloud
#      Functions and App Hosting: the script stops and tells you if it is not.
#   2. Enables the APIs the template uses.
#   3. Creates the Firestore database (native mode) in the region.
#   4. Enables Email/Password sign-in in Firebase Auth.
#   5. Creates (or reuses) a Firebase web app and writes its public config into apps/web/apphosting.<env>.yaml.
#   6. Adds the project to .firebaserc under the alias <env>.
#   7. (--github) configures Workload Identity Federation for GitHub Actions (scripts/configure-wif.sh).
#
# Then it prints the one step that needs a browser: creating the App Hosting backend connected to your repo.
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

PROJECT_ID="${1:-}"
ENVIRONMENT="$(read_environment "${2:-}")"
shift 2 || true
CREATE=false
REGION="us-central1"
GITHUB_REPOSITORY_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --create) CREATE=true ;;
        --region) REGION="$2"; shift ;;
        --github) GITHUB_REPOSITORY_ARG="$2"; shift ;;
        *) fail "Unknown option $1" ;;
    esac
    shift
done

[[ "$PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail "Usage: $0 <project-id> <qa|prod> [--create] [--region r] [--github owner/repo]"
require_command gcloud "Install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"
[[ -n "$ACCOUNT" && "$ACCOUNT" != "(unset)" ]] || fail "Run 'gcloud auth login' first."
pnpm exec firebase login:list 2>/dev/null | grep -q '@' || fail "Run 'pnpm exec firebase login' first."

log "Project $PROJECT_ID ($ENVIRONMENT) as $ACCOUNT"

if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
    $CREATE || fail "Project $PROJECT_ID does not exist or you cannot see it. Pass --create to create it."
    gcloud projects create "$PROJECT_ID" --quiet
    ok "Project created"
fi
if ! pnpm exec firebase projects:list 2>/dev/null | grep -q "$PROJECT_ID"; then
    pnpm exec firebase projects:addfirebase "$PROJECT_ID" >/dev/null
    ok "Firebase added"
fi

BILLING="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null || true)"
if [[ "$BILLING" != "True" ]]; then
    fail "Billing is not enabled on $PROJECT_ID. Link a billing account (Blaze plan) and run this again:
    https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
fi
ok "Billing enabled"

log "Enabling APIs"
gcloud services enable \
    firebase.googleapis.com \
    identitytoolkit.googleapis.com \
    firestore.googleapis.com \
    firebaserules.googleapis.com \
    firebasestorage.googleapis.com \
    storage.googleapis.com \
    cloudfunctions.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    eventarc.googleapis.com \
    pubsub.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    firebaseapphosting.googleapis.com \
    developerconnect.googleapis.com \
    iam.googleapis.com \
    iamcredentials.googleapis.com \
    sts.googleapis.com \
    --project "$PROJECT_ID" --quiet
ok "APIs enabled"

log "Firestore"
if gcloud firestore databases describe --database='(default)' --project "$PROJECT_ID" >/dev/null 2>&1; then
    ok "Database (default) exists"
else
    gcloud firestore databases create --database='(default)' --location="$REGION" \
        --project "$PROJECT_ID" --quiet
    ok "Database (default) created in $REGION"
fi

log "Firebase Auth: Email/Password"
TOKEN="$(gcloud auth print-access-token)"
# Initializes Identity Platform config if needed, then turns on email/password sign-in.
curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT_ID" \
    "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/identityPlatform:initializeAuth" \
    -o /dev/null 2>/dev/null || true
curl -fsS -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT_ID" \
    -H 'Content-Type: application/json' \
    "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/config?updateMask=signIn.email" \
    -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' -o /dev/null &&
    ok "Email/Password enabled" ||
    warn "Could not enable Email/Password automatically. Enable it in the console: Authentication → Sign-in method."

log "Firebase web app"
APP_ID="$(pnpm exec firebase apps:list WEB --project "$PROJECT_ID" --json 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).result||[];process.stdout.write(r[0]?.appId||"")})')"
if [[ -z "$APP_ID" ]]; then
    pnpm exec firebase apps:create WEB "web" --project "$PROJECT_ID" >/dev/null
    APP_ID="$(pnpm exec firebase apps:list WEB --project "$PROJECT_ID" --json |
        node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{process.stdout.write(JSON.parse(s).result[0].appId)})')"
    ok "Web app created ($APP_ID)"
else
    ok "Web app exists ($APP_ID)"
fi
SDK_CONFIG="$(pnpm exec firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" --json)"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
API_BASE_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net"

node - "$ENVIRONMENT" "$API_BASE_URL" "$SDK_CONFIG" <<'NODE'
const fs = require('fs');
const [environment, apiBaseUrl, raw] = process.argv.slice(2);
const parsed = JSON.parse(raw);
const config = parsed.result?.sdkConfig ?? parsed.result ?? parsed;
const vars = {
    APP_ENVIRONMENT: { value: environment, availability: ['BUILD', 'RUNTIME'] },
    NEXT_PUBLIC_APP_ENVIRONMENT: { value: environment, availability: ['BUILD'] },
    NEXT_PUBLIC_API_BASE_URL: { value: apiBaseUrl, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_API_KEY: { value: config.apiKey, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: { value: config.authDomain, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: { value: config.projectId, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: { value: config.storageBucket, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: { value: config.messagingSenderId, availability: ['BUILD'] },
    NEXT_PUBLIC_FIREBASE_APP_ID: { value: config.appId, availability: ['BUILD'] },
};
const lines = [
    `# App Hosting configuration for ${environment}. Generated by scripts/setup-gcp.sh; safe to edit and commit:`,
    '# every value here is public (it ships in the browser bundle). Secrets go in Secret Manager, never here.',
    'runConfig:',
    '    minInstances: 0',
    `    maxInstances: ${environment === 'prod' ? 20 : 4}`,
    '    concurrency: 80',
    '    cpu: 1',
    '    memoryMiB: 1024',
    'env:',
];
for (const [name, { value, availability }] of Object.entries(vars)) {
    lines.push(`    - variable: ${name}`, `      value: "${value ?? 'REPLACE_ME'}"`, '      availability:');
    for (const a of availability) lines.push(`          - ${a}`);
}
fs.writeFileSync(`apps/web/apphosting.${environment}.yaml`, lines.join('\n') + '\n');
NODE
ok "Wrote apps/web/apphosting.$ENVIRONMENT.yaml"

node -e '
    const fs = require("fs");
    const [file, alias, id] = process.argv.slice(1);
    const rc = JSON.parse(fs.readFileSync(file, "utf8"));
    rc.projects = { ...rc.projects, [alias]: id };
    fs.writeFileSync(file, JSON.stringify(rc, null, 4) + "\n");
' .firebaserc "$ENVIRONMENT" "$PROJECT_ID"
ok ".firebaserc: alias '$ENVIRONMENT' → $PROJECT_ID"

if [[ -n "$GITHUB_REPOSITORY_ARG" ]]; then
    bash scripts/configure-wif.sh "$PROJECT_ID" "$ENVIRONMENT" "$GITHUB_REPOSITORY_ARG"
fi

ENV_UPPER="$(printf '%s' "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')"
cat <<NEXT

$(printf '\033[1m')Done. One step needs a browser: the App Hosting backend.$(printf '\033[0m')

  pnpm exec firebase apphosting:backends:create --project $PROJECT_ID \\
      --backend web --primary-region $REGION --root-dir apps/web --app $APP_ID

  Connect it to your GitHub repository, set the live branch to "main" and turn OFF automatic rollouts
  (deploys come from tags, see docs/DEPLOY.md).

  When it exists, connect it to the rest (environment name, rollouts off, CORS, Auth domain and email links):
      pnpm setup:web $ENVIRONMENT
  and check where you are any time with: pnpm doctor $ENVIRONMENT

  Project number (for ${ENV_UPPER}_FIREBASE_PROJECT_NUMBER): $PROJECT_NUMBER
NEXT
