## What and why

<!-- One or two sentences: what changes for the person using the product, and why. -->

## How it was verified

- [ ] `pnpm check:changed` is green
- [ ] Tried it locally (`pnpm dev`) — describe what you clicked
- [ ] New UI text is in `packages/i18n/src/messages/*` for every language (no hardcoded strings)
- [ ] New routes use English kebab-case paths and are documented in `docs/API.md`
- [ ] Firestore rules / indexes updated if a new collection or query was added
