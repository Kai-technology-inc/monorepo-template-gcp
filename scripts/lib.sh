# Shared helpers for the scripts in this folder. Source it: `source "$(dirname "$0")/lib.sh"`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n\033[1;36m[%s]\033[0m %s\n' "$(basename "$0")" "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
fail() { printf '\n\033[1;31m[%s]\033[0m %s\n' "$(basename "$0")" "$*" >&2; exit 1; }

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing '$1'. $2"
}

# Normalizes the environment argument (qa|prod) and fails on anything else.
read_environment() {
    local value
    value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
    case "$value" in
        qa | prod) printf '%s' "$value" ;;
        *) fail "Environment must be 'qa' or 'prod', got '${1:-}'." ;;
    esac
}

# The project id for an environment: $FIREBASE_PROJECT_ID, else the alias in .firebaserc.
project_for() {
    local environment="$1"
    if [[ -n "${FIREBASE_PROJECT_ID:-}" ]]; then
        printf '%s' "$FIREBASE_PROJECT_ID"
        return
    fi
    node -e '
        const rc = require(process.argv[1]);
        const id = rc.projects && rc.projects[process.argv[2]];
        if (!id) process.exit(1);
        process.stdout.write(id);
    ' "$REPO_ROOT/.firebaserc" "$environment" ||
        fail "No project for '$environment': set FIREBASE_PROJECT_ID or run 'pnpm setup:gcp <project-id> $environment'."
}
