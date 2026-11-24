## Request

<!-- One or two sentences: what was asked and why, in terms of what changes for the person using the product. -->

Ticket / card: <!-- link to the originating ticket or card, or "none" -->

## Acceptance criteria and evidence

<!--
One row per criterion, taken from the ticket. "Test" is the spec that proves it (file › test name); "Result" is
what it gave on this branch: passed, failed, or not run (and why). A criterion no test can prove says how it was
checked instead (what was clicked, with a screenshot).
-->

| #   | Acceptance criterion | Test that proves it | Result |
| --- | -------------------- | ------------------- | ------ |
| 1   |                      |                     |        |

## Rollout

<!--
User-visible change: the flag it ships behind (its key in FLAGS), who gets it first, and the metric that would stop
the rollout (docs/FLAGS.md). Otherwise: "No user-visible change". Removing a fully rolled out flag: say which.
-->

## Checks

- [ ] `pnpm check:changed` is green
- [ ] A change with a screen has a behavior test in `apps/e2e` (what the person does and what the web sends to the
      API), and `pnpm test:e2e` is green
- [ ] A user-visible change is behind a flag declared in `FLAGS`, or this PR removes one that is fully rolled out
- [ ] New UI text is in `packages/i18n/src/messages/*` for every language (no hardcoded strings)
- [ ] New routes use English kebab-case paths and are documented in `docs/API.md`
- [ ] Firestore rules / indexes updated if a new collection or query was added
