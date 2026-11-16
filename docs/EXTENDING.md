# Extending the template

How to add product features without breaking the shape of the repository. The running example is a **Projects**
module: a list of projects inside each workspace.

## 1. Small feature or new module?

- **A feature of an existing area** (a new field on the workspace, a new member action): add it to the existing
  packages: contract in `packages/contracts`, endpoint in `packages/api-workspace`, screen in `packages/web-platform`.
- **A new area of the product** (projects, billing, CRM…): give it its own packages, so it can grow, be owned and be
  tested on its own:

```text
packages/contracts/src/projects.ts      (or packages/contracts-projects if it gets big)
packages/api-projects/                  NestJS module(s): controllers, services, specs
packages/web-projects/                  screens
apps/functions/src/index.ts             a new `projects` Function
apps/api/src/app.module.ts              mount ProjectsModule under 'projects' (or under 'workspaces')
```

A vertical **never imports another vertical**: if Projects needs something from Billing, it goes through
`api-core`/`api-workspace` (a port, an event) or through the contracts.

## 2. Contract first

```ts
// packages/contracts/src/projects.ts
export const ProjectSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  name: z.string().trim().min(1).max(80),
  createdAt: IsoDateTimeSchema,
});
export const CreateProjectRequestSchema = ProjectSchema.pick({ name: true }).strict();
```

Export it from `src/index.ts`, add the routes to `apiRoutes` (`/workspaces/:workspaceId/projects`), any new
permission to `PERMISSIONS`/`ROLE_PERMISSIONS`, and any new error code to `ERROR_CODES`.

## 3. API

- Data lives under the tenant: `workspaces/{workspaceId}/projects/{projectId}`.
- Routes live under `/workspaces/:workspaceId/…`: the guard resolves the caller's membership in that workspace, and
  `@RequirePermission('projects:write')` does the rest.
- Validate bodies with the contract (`@Body(new ZodBody(CreateProjectRequestSchema))`), throw `AppError` with a code,
  return contract types.
- Every business rule gets a unit spec against the in-memory store (`packages/api-core/src/persistence/testing`).
- Add the Function in `apps/functions/src/index.ts` and the prefix in `apps/api/src/app.module.ts`; add the package to
  the allowed imports in `apps/api/src/arch/layers.spec.ts` and the new package's `eslint.config.mjs`.
- New query? Add its index to `apps/api/firestore.indexes.json`. New collection the client may read? Add a rule and a
  rules spec. Then document the endpoints in `docs/API.md`.

## 4. Web

- Screens go in the module's web package, routes in `apps/web/src/app/(app)/projects/page.tsx` (a few lines that
  render the screen).
- Call the API with `callApi(apiRoutes.…, { schema })`; gate actions with `can('projects:write')`.
- Every text through `t()`: add the keys to `en.ts` and every other dictionary in `packages/i18n/src/messages/`.
  The compiler tells you which ones are missing.
- Add the nav entry in the app shell.

## 5. Verify

```bash
pnpm check:changed
pnpm dev     # and click through it
```

## Common additions

- **Sending email** (invitations, notifications): add a provider (SendGrid, Resend…) behind a small `Mailer`
  interface in `api-core`, its API key as a Secret Manager secret (`defineSecret`), and send from
  `InvitationsService.create`. Keep templates per locale; the recipient's `locale` is on their profile.
- **Google sign-in**: enable the provider in Firebase Auth and add a button calling `signInWithPopup` in
  `web-kit`'s AuthContext; `POST /account/register` works the same for any provider.
- **Background work**: Firestore triggers or scheduled Functions in `apps/functions/src/index.ts`, with the logic in a
  package service so it is unit-tested.
- **File uploads**: Storage with signed URLs issued by the API; extend `storage.rules` only if the client must read
  directly.
