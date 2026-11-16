# @app/api-workspace

Layer 2 of the API: accounts, workspaces, members and invitations: the product the template ships. Built on
`@app/api-core` and `@app/contracts`; every endpoint is documented in [`docs/API.md`](../../docs/API.md).

| Module             | Function     | Routes                                                                       |
| ------------------ | ------------ | ---------------------------------------------------------------------------- |
| `AccountModule`    | `account`    | `/account/*`: register, session, profile, active workspace                   |
| `WorkspacesModule` | `workspaces` | `/workspaces`, `/workspaces/:workspaceId`, its `members` and `invitations`   |
| `HealthController` | both         | `GET /health`: public, no dependencies (uptime checks and the deploy script) |

## The rules live in the services

- **`MembersService`**: nobody changes their own role; only an owner grants or removes ownership; a workspace never
  ends without an owner (`LAST_OWNER`).
- **`InvitationsService`**: invitations by link. Creating one returns `acceptPath` with a secret token; only its hash
  is stored (`invitation-token.ts`). Expiry is `INVITATION_TTL_DAYS`. The template sends no email: call your
  provider at the end of `create()` (see [`docs/EXTENDING.md`](../../docs/EXTENDING.md)).
- **`WorkspacesService` / `workspace-writer.ts`**: slugs are unique; a derived one gets `-2`, `-3`…
- **`SessionService`**: every endpoint that changes what the shell shows answers with a fresh `Session`.
- **`records.ts`**: a stored document is its public contract plus server-only fields; parsing with the public schema
  drops them, which is how they never reach a response.

## Tests

Every rule has a spec against one in-memory store and one fixed clock (`testing/workspace-kit.ts`):
`pnpm turbo run test --filter=@app/api-workspace`. The HTTP wiring (guard, prefixes, error shape) is tested in
`apps/api/src/app.e2e.spec.ts`.

A new product area gets its own package next to this one (`api-projects`…), not a folder in it: see
[`docs/EXTENDING.md`](../../docs/EXTENDING.md).
