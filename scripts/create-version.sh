#!/usr/bin/env bash
# Cuts a release candidate: bumps the root version (patch), commits "chore(release): rcX.Y.Z", tags rcX.Y.Z and
# pushes. The tag is the version; GitHub Actions (deploy-qa.yml) deploys it to QA.
#
#   pnpm create-version          # asks before pushing
#   pnpm create-version --yes
#
# Production is a GitHub Release (tag vX.Y.Z) created by a person from a tested rc: see docs/DEPLOY.md.
source "$(dirname "$0")/lib.sh"
cd "$REPO_ROOT"

BRANCH="${TARGET_BRANCH:-main}"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "$BRANCH" ]] || fail "Run from '$BRANCH' (or set TARGET_BRANCH)."
[[ -z "$(git status --porcelain)" ]] || fail "The working tree is not clean."
git fetch origin "$BRANCH" --tags --quiet
[[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$BRANCH")" ]] || fail "'$BRANCH' is not up to date with origin."

VERSION="$(node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const [major, minor, patch] = pkg.version.split(".").map(Number);
    pkg.version = `${major}.${minor}.${patch + 1}`;
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");
    process.stdout.write(pkg.version);
')"
TAG="rc$VERSION"

if [[ "${1:-}" != "--yes" ]]; then
    read -r -p "Create and push $TAG? [y/N] " answer
    [[ "$answer" =~ ^[yY]$ ]] || { git checkout -- package.json; fail "Cancelled."; }
fi

git commit -am "chore(release): $TAG" --quiet
git tag -a "$TAG" -m "$TAG"
git push origin "$BRANCH" --quiet
git push origin "$TAG" --quiet
ok "Pushed $TAG: GitHub Actions deploys it to QA (deploy-qa.yml)."
