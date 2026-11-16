# @app/api-core

Layer 1 of the API: what every product module stands on. It imports only `@app/contracts`. Import paths are per
file: `@app/api-core/auth/decorators`, `@app/api-core/persistence/store`…

| Folder         | What                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`        | `FirebaseAuthGuard` (global, on every route), the decorators below, `SessionResolver` (identity → `AuthContext` with the caller's role in the route's workspace) |
| `config/`      | `environment.ts`: the only file that reads `process.env` for configuration                                                                                       |
| `firebase/`    | Firebase Admin app and `IdTokenVerifier` (replaced by `FakeTokenVerifier` in tests)                                                                              |
| `http/`        | `AppError`, `AllExceptionsFilter` (every error leaves as an `ApiErrorBody`), `ZodBody`/`ZodQuery`, request ids                                                   |
| `persistence/` | `Store` (the persistence port), `FirestoreStore`, `paths.ts` (the only place that spells a Firestore path), timestamps                                           |
| `time/`        | `CLOCK`: services ask it for the time, so rules that depend on time are testable                                                                                 |
| `testing/`     | `InMemoryStore` (transactions included), `FakeTokenVerifier`, `TestPlatformModule`, identities                                                                   |

## Auth, route by route

The guard runs on every route; a route opts out explicitly.

| Decorator                               | Effect                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@Public()`                             | no token (health checks, what a link shows before sign-in)                                                                                        |
| `@IdentityOnly()`                       | a valid token is enough; the profile may not exist yet (`POST /account/register`); inject it with `@CurrentIdentity()`                            |
| `@AllowUnverifiedEmail()`               | reachable before the email is verified (`AUTH_REQUIRE_VERIFIED_EMAIL`, default true outside `local`), so the web can show the verification screen |
| `@OutsideWorkspace()`                   | the route has a `:workspaceId` but the caller need not be a member yet (accepting an invitation)                                                  |
| `@RequirePermission('x:y')`             | the caller's role in the route's workspace must have the permission (`ROLE_PERMISSIONS`)                                                          |
| `@CurrentAuth()` / `@CurrentIdentity()` | parameter decorators: the resolved `AuthContext` / the verified identity                                                                          |

Check permissions, never roles: `@RequirePermission('members:manage')`, not "if OWNER".

## Rules of thumb

- **Fail on purpose with `AppError`**: `throw new AppError('LAST_OWNER', 409, '…')`. The code must exist in
  `ERROR_CODES` (contracts) and have a message in every dictionary; the English message is for developers.
- **Validate with the contract**: `@Body(new ZodPipe(Schema))` or `@ZodBody(Schema)`; no hand-written DTOs.
- **Read and write through `Store`**, never the Firestore SDK, and parse what you read with its schema
  (`parseDocument`). Multi-document changes go in `store.runTransaction`.
- **A new setting** is a function in `config/environment.ts`, with its default and the reason for it.

Tests: `pnpm turbo run test --filter=@app/api-core` (Vitest, no emulator).
