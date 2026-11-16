#!/usr/bin/env bash
# Local development: the Firebase emulators (Auth, Firestore, Storage), the API in watch mode and the web.
# No Google Cloud account needed: the `demo-template` project only exists inside the emulators.
#
#   pnpm dev
#
# Emulator UI: http://127.0.0.1:4000 · API: http://localhost:3100 · Web: http://localhost:3000
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

require_command java "The Firestore emulator needs Java 17+ (e.g. 'brew install openjdk@17')."

for app in api web; do
    if [[ ! -f "apps/$app/.env" && -f "apps/$app/.env.example" ]]; then
        cp "apps/$app/.env.example" "apps/$app/.env"
        ok "Created apps/$app/.env from .env.example"
    fi
done
if [[ -f apps/web/.env && ! -f apps/web/.env.local ]]; then
    cp apps/web/.env apps/web/.env.local
fi

log "Building the workspace packages the API and the web depend on"
pnpm turbo run build --filter='@app/api^...' --filter='@app/web^...' --output-logs=errors-only

pids=()
cleanup() {
    log "Stopping"
    for pid in ${pids[@]+"${pids[@]}"}; do kill "$pid" 2>/dev/null || true; done
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

log "Starting the emulators (state persists in .emulator-data/)"
pnpm exec firebase emulators:start --only auth,firestore,storage --project demo-template \
    --import .emulator-data --export-on-exit .emulator-data &
pids+=($!)

# Wait for Firestore before starting the API, so its first request does not fail.
for _ in $(seq 1 60); do
    curl -s -o /dev/null http://127.0.0.1:8080 && break
    sleep 1
done

log "Starting the API on :3100 and the web on :3000"
pnpm --filter @app/api dev &
pids+=($!)
pnpm --filter @app/web dev &
pids+=($!)

# Stop everything as soon as one of the three exits (bash 3.2 on macOS has no `wait -n`).
while true; do
    for pid in "${pids[@]}"; do
        kill -0 "$pid" 2>/dev/null || exit 1
    done
    sleep 2
done
