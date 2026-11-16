# API reference

The HTTP surface of the template. Schemas live in `@app/contracts` (`packages/contracts/src`), URL helpers in
`apiRoutes` (`packages/contracts/src/api-routes.ts`). Every top-level segment is one Cloud Function and one
`RouterModule` prefix on the local server, so a path is identical locally, in the emulator and deployed:

| Where            | Base URL                                           |
| ---------------- | -------------------------------------------------- |
| Local API server | `http://localhost:3100`                            |
| Emulator         | `http://127.0.0.1:5001/<project>/us-central1`      |
| Deployed         | `https://us-central1-<project>.cloudfunctions.net` |

The web reads it from `NEXT_PUBLIC_API_BASE_URL`.

## Conventions

- **Auth.** `Authorization: Bearer <Firebase ID token>`. The guard verifies it with the Admin SDK on every route
  except those marked `@Public()`.
- **Identity-only routes** (`@IdentityOnly()`) only need a valid token: they work before the profile exists
  (`POST /account/register`).
- **Verified email.** With `AUTH_REQUIRE_VERIFIED_EMAIL=true` (default in qa/prod), every route that is not
  `@Public()`, `@IdentityOnly()` or `@AllowUnverifiedEmail()` answers `403 EMAIL_NOT_VERIFIED` to an unverified
  identity. `GET /account/session` and `PATCH /account/profile` allow unverified emails so the web can render the
  verification screen.
- **Workspace scope.** Routes under `/workspaces/:workspaceId/...` resolve the caller's membership in _that_
  workspace (not the active one). Not a member → `403 NOT_A_MEMBER`. Permissions come from the role
  (`ROLE_PERMISSIONS` in `roles.ts`) and are declared per route with `@RequirePermission(...)`.
- **Validation.** Bodies are parsed with the contract's zod schema (`ZodBody(schema)`); unknown fields are rejected.
  Failure → `400 VALIDATION_FAILED` with `issues` keyed by path.
- **Errors.** Always `ApiErrorBody`: `{ statusCode, code, message, requestId?, issues? }`. `code` is one of
  `ERROR_CODES`; the web translates it. `message` is English, for developers.
- **Ids and timestamps.** Ids are Firestore document ids. Timestamps are ISO 8601 strings.
- **Request id.** The API echoes `X-Request-Id` (or generates one) and logs it.

## Health

| Method | Path                 | Auth   | Response                                  |
| ------ | -------------------- | ------ | ----------------------------------------- |
| GET    | `/account/health`    | Public | `{ status: 'ok', service: 'account' }`    |
| GET    | `/workspaces/health` | Public | `{ status: 'ok', service: 'workspaces' }` |

## Account (`account` function)

| Method | Path                        | Auth                   | Body                     | Response  | Errors                   |
| ------ | --------------------------- | ---------------------- | ------------------------ | --------- | ------------------------ |
| POST   | `/account/register`         | Identity only          | `RegisterRequest`        | `Session` | `409 ALREADY_REGISTERED` |
| GET    | `/account/session`          | Session, unverified ok | —                        | `Session` | `403 NOT_REGISTERED`     |
| PATCH  | `/account/profile`          | Session, unverified ok | `UpdateProfileRequest`   | `Session` | `403 NOT_REGISTERED`     |
| PUT    | `/account/active-workspace` | Session                | `SwitchWorkspaceRequest` | `Session` | `403 NOT_A_MEMBER`       |

- `register` creates `users/{uid}` from the token's email and the body's `displayName`/`locale`. With
  `workspaceName` it also creates the first workspace (caller is `OWNER`) and makes it active. Without it (someone
  joining through an invitation) `activeWorkspaceId` is `null`.
- `session` returns the profile, the active workspace, the caller's role and permissions there, every membership,
  `emailVerified` and `emailVerificationRequired`.

## Workspaces (`workspaces` function)

| Method | Path                                                                 | Permission                         | Body                      | Response                   | Errors                                                                                                      |
| ------ | -------------------------------------------------------------------- | ---------------------------------- | ------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| POST   | `/workspaces`                                                        | any registered user                | `CreateWorkspaceRequest`  | `Session`                  | `409 SLUG_TAKEN` (only when the slug was given explicitly)                                                  |
| PATCH  | `/workspaces/:workspaceId`                                           | `workspace:update`                 | `UpdateWorkspaceRequest`  | `Workspace`                |                                                                                                             |
| GET    | `/workspaces/:workspaceId/members`                                   | `members:read`                     | —                         | `MemberListResponse`       |                                                                                                             |
| PATCH  | `/workspaces/:workspaceId/members/:userId`                           | `members:manage`                   | `UpdateMemberRoleRequest` | `Member`                   | `403 CANNOT_CHANGE_OWN_ROLE`, `403 FORBIDDEN`, `409 LAST_OWNER`, `404`                                      |
| DELETE | `/workspaces/:workspaceId/members/:userId`                           | `members:manage` (or self)         | —                         | `204`                      | `409 LAST_OWNER`, `404`                                                                                     |
| GET    | `/workspaces/:workspaceId/invitations`                               | `invitations:manage`               | —                         | `InvitationListResponse`   |                                                                                                             |
| POST   | `/workspaces/:workspaceId/invitations`                               | `invitations:manage`               | `CreateInvitationRequest` | `CreateInvitationResponse` | `409 ALREADY_A_MEMBER`                                                                                      |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId`                 | `invitations:manage`               | —                         | `204`                      | `404`                                                                                                       |
| GET    | `/workspaces/:workspaceId/invitations/:invitationId/preview?token=…` | Public                             | —                         | `InvitationPreview`        | `404 INVITATION_INVALID`, `410 INVITATION_EXPIRED`                                                          |
| POST   | `/workspaces/:workspaceId/invitations/:invitationId/accept`          | registered user (not yet a member) | `AcceptInvitationRequest` | `Session`                  | `404 INVITATION_INVALID`, `410 INVITATION_EXPIRED`, `403 INVITATION_EMAIL_MISMATCH`, `409 ALREADY_A_MEMBER` |

Rules worth knowing:

- **Creating a workspace** makes the caller `OWNER` and switches their active workspace to it. Without an explicit
  slug, one is derived from the name (`slugify`) and made unique with a suffix. Slug uniqueness is enforced with a
  `workspaceSlugs/{slug}` document created in the same transaction.
- **Roles.** Only an `OWNER` can grant or revoke `OWNER`. Nobody changes their own role. A workspace always keeps at
  least one `OWNER` (`LAST_OWNER`), checked inside a transaction.
- **Removing a member** (or leaving, when `userId` is the caller) deletes the membership; if it was the person's
  active workspace, their `activeWorkspaceId` moves to another membership or `null`.
- **Invitations.** The token is 32 random bytes (base64url); only its SHA-256 is stored (`tokenHash`). Inviting an
  email that already has a pending invitation revokes the old one. `acceptPath` is
  `/auth/invitations/accept?workspace=<workspaceId>&invitation=<invitationId>&token=<token>` (a path on the web).
  Accepting requires the caller's token email to equal the invitation's email; it creates the membership, marks the
  invitation `ACCEPTED` and makes the workspace active, all in one transaction. Expired = `expiresAt` in the past
  (`INVITATION_TTL_DAYS`). The template does not send email: plug a provider in `InvitationsService`.

## Firestore layout

```text
users/{userId}                                   UserProfile
workspaces/{workspaceId}                         Workspace
workspaces/{workspaceId}/members/{userId}        Member  (+ workspaceId, for the collection-group query)
workspaces/{workspaceId}/invitations/{id}        Invitation (+ tokenHash, acceptedBy, acceptedAt)
workspaceSlugs/{slug}                            { workspaceId }
```

The client SDK never writes: `firestore.rules` denies every write and only lets a signed-in person read their own
`users/{uid}` and the workspaces (and members) they belong to. All writes go through the API with the Admin SDK.
