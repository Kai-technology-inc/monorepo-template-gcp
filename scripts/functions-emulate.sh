#!/usr/bin/env bash
# Runs the real Functions bundle (what gets deployed) in the emulator, next to Auth and Firestore.
#
#   pnpm functions:emulate
#   curl http://127.0.0.1:5001/demo-template/us-central1/account/health
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

pnpm turbo run bundle:functions --filter @app/functions --output-logs=errors-only
cat > apps/functions/.functions/.env <<ENV
APP_ENVIRONMENT=local
ALLOWED_ORIGINS=http://localhost:3000
AUTH_REQUIRE_VERIFIED_EMAIL=false
FLAGS_ADMIN_WORKSPACE_ID=*
ENV
pnpm exec firebase emulators:start --only functions,auth,firestore --project demo-template
