# @app/web-kit

The web's primitives: design tokens, UI components, the Firebase and HTTP clients, and the session. Screens live in
`@app/web-platform` (or your module's web package); this package has none. Published as source; one entry,
`@app/web-kit`.

| Area       | What                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `styles/`  | `tokens.css` (colors, spacing, type: light and dark) and `kit.css`. Use the tokens; no hard-coded colors                                    |
| `ui/`      | `Button`, `Card`, `TextField`/`SelectField` (labelled, `aria-*` wired), `Table`, `Alert`, `ConfirmDialog` (native `<dialog>`), `Spinner`…   |
| `context/` | `AuthProvider` / `useAuth()`: Firebase sign-in state plus the API `Session`; `sessionCan(session, 'members:manage')`                        |
| `lib/`     | `callApi` (the only way to call the API), `useApiQuery`, `ApiError` + `useErrorMessage`, `ROUTES` + `withNext`, `readWebEnv`, locale cookie |

## Rules of thumb

- **Call the API only with `callApi(apiRoutes.…(), { schema })`**: it adds the ID token and a request id, parses the
  response with the contract and turns failures into `ApiError`s.
- **Show errors with `useErrorMessage()`**: API codes read `errors.<CODE>`, Firebase Auth codes `auth.errors.*`.
  Never print `error.message`.
- **Link with `ROUTES`**, never a string literal; URL segments are English kebab-case.
- **Gate actions with permissions** (`sessionCan`), never roles.
- **Configuration** is `readWebEnv()`: `NEXT_PUBLIC_*` variables written out literally, so Next inlines them.

Tests: `pnpm turbo run test --filter=@app/web-kit` (Vitest in Node: rules are pure functions and components are
rendered to a string).
