# Contributing

1. `pnpm install`, then `pnpm dev` to run everything locally against the emulators.
2. Branch from `main`. Keep a pull request to one change you can explain in two sentences.
3. Before pushing: `pnpm check:changed` (typecheck, lint, tests and architecture specs of what you touched).
4. Follow the rules in [`AGENTS.md`](AGENTS.md): layers, no hardcoded UI text, English kebab-case URLs, contracts
   first, no client writes to Firestore.
5. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(members): …`,
   `fix(i18n): …`).
