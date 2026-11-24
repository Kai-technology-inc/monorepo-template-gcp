# Feature flags

**Deploying is not releasing.** A deploy puts code in production; a release decides who sees it. A user-visible
change ships switched off, behind a flag declared in the contracts, and is turned on later (for your team, then a
percentage of people, then everyone) without another deploy. If something goes wrong, turning the flag off is one
call, not a rollback. When the change is fully rolled out, the flag is removed.

## How it fits together

```text
packages/contracts/src/flags.ts       FLAGS: every flag, its value type (zod), its default
            │
packages/api-core/src/flags/          FlagsProvider (the port) + one adapter per folder, chosen by FLAGS_PROVIDER
            │   evaluate(key, { userId, workspaceId, attributes })   never throws: default on any failure
            ▼
GET /account/session (and every route that answers a Session)   →   session.flags, parsed with the contract
            │
packages/web-kit  useFlag('key')      the screen reads the value; the browser never evaluates anything
```

- **Evaluated in the API, never in the browser.** No provider SDK or key reaches the client. The web receives the
  values with the session, so switching workspace re-evaluates them for free.
- **The port never fails a request.** An adapter may throw, hang or answer garbage; `FlagsProvider.evaluate()` turns
  each case into the flag's declared default and a log line (`FLAGS_TIMEOUT_MS`, default 1000 ms, bounds a slow
  provider).
- **Flags are global to the deployment**, not per workspace. A workspace is a target (an allow-list entry, a
  percentage bucket), never the owner of a flag.

## Declaring a flag

One entry in `FLAGS` (`packages/contracts/src/flags.ts`):

```ts
export const FLAGS = {
  'dashboard-whats-new': defineFlag.boolean({
    defaultValue: false,
    description: 'Shows the "What\'s new" card on the dashboard.',
    addedOn: '2026-11-24',
  }),
  'checkout-layout': defineFlag.string(
    {
      defaultValue: 'classic',
      description: 'Which checkout the person sees.',
      addedOn: '2026-12-01',
    },
    z.enum(['classic', 'single-page']),
  ),
  'export-row-limit': defineFlag.number(
    { defaultValue: 1000, description: '…', addedOn: '…' },
    z.number().int(),
  ),
  banner: defineFlag.json(z.object({ tone: z.enum(['info', 'warning']) }), {
    defaultValue: { tone: 'info' },
    description: '…',
    addedOn: '…',
  }),
};
```

- **Key**: English kebab-case, like a URL segment. LaunchDarkly uses it as is; Remote Config replaces `-` with `_`.
- **Default**: what everyone gets when nothing targets the flag, when it is off, and when the provider fails. Pick
  the safe, current behavior: for a new feature, "off".
- **Value type**: a zod schema. A value from a provider that does not match it is ignored (default + log).
- `apps/api/src/arch/flags.spec.ts` fails if code asks for a key that is not declared, and if a declared key is no
  longer read anywhere (a stale flag: remove it).

## Wrapping a user-visible change

In a screen:

```tsx
const whatsNew = useFlag('dashboard-whats-new'); // before any early return: it is a hook
return whatsNew ? <NewThing /> : <OldThing />;
```

In the API (inject `FlagsProvider`, from `@app/api-core/flags/flags-provider`):

```ts
const layout = await this.flags.evaluate('checkout-layout', {
  userId: auth.userId,
  workspaceId: auth.workspaceId,
});
```

Rules of thumb:

- **Both branches must work** and be tested: the behavior test (`apps/e2e`) covers what the person sees with the flag
  off and on; flip it with the admin route, as `apps/e2e/src/flags.spec.ts` does.
- **Keep the branch at the edge**: one `useFlag` per screen, not a check inside every component. The old path is what
  you delete later.
- **A flag guards a change, not a configuration.** A value the product owner tunes forever (a price, a limit per plan)
  belongs in the data model, not in `FLAGS`.
- Flags reach the web with the session, so they apply to signed-in screens. A flag for the signed-out pages needs a
  public endpoint that evaluates with an anonymous context; the template does not have one.

## Rolling it out

Before turning anything on, write in the PR (or the ticket) **the metric that would stop the rollout** and its
threshold: error rate of the new route, a conversion step, a support-ticket tag. Decide it before looking at the data.

1. **The team.** Allow-list your own workspace. Use it for real for a while.
2. **A percentage.** 5–10% of people (or of workspaces, with `bucketBy: workspace` when a team must see the same
   thing). Watch the metric. Raise it in steps (25, 50…): raising the percentage keeps everyone who already had it,
   so nobody flickers.
3. **Everyone.** 100%. Keep watching for a few days.
4. **Off, at any moment.** The kill switch puts everyone back on the default within `FLAGS_CACHE_SECONDS`.

With the own provider (Firestore), each step is one call to the admin routes, from the operator workspace
(`FLAGS_ADMIN_WORKSPACE_ID`, owners and admins; `docs/API.md` has the details):

```bash
API=https://us-central1-<project>.cloudfunctions.net
FLAG=$API/workspaces/<operator workspace id>/flags/dashboard-whats-new
AUTH="Authorization: Bearer <ID token of an owner or admin of that workspace>"

curl -X PUT "$FLAG" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"value": true, "allowList": {"workspaceIds": ["<operator workspace id>"]}}'      # 1. the team
curl -X PUT "$FLAG" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"value": true, "percent": 10, "allowList": {"workspaceIds": ["<…>"]}}'          # 2. + 10%
curl -X PUT "$FLAG" -H "$AUTH" -H 'Content-Type: application/json' -d '{"value": true, "percent": 100}'  # 3.
curl -X DELETE "$FLAG" -H "$AUTH"                                                      # 4. off
curl "$API/workspaces/<operator workspace id>/flags" -H "$AUTH"                        # where every flag stands
```

Locally, `apps/api/.env` sets `FLAGS_ADMIN_WORKSPACE_ID=*` (any workspace, honored only in `local`), and Swagger at
`http://localhost:3100/docs` calls the same routes. With LaunchDarkly or Remote Config the steps are the same, in
their consoles.

## Removing a flag

When a flag has been at 100% for long enough that nobody would turn it off (days, not months):

1. Delete the old branch and the `useFlag`/`evaluate` call; the new behavior becomes the only one.
2. Delete its line in `FLAGS`. The compiler shows any leftover; the arch spec fails if you forget step 1 or 2.
3. Remove its rule: `DELETE …/flags/<key>` (own provider; a rule left behind for an undeclared flag is ignored
   anyway), or archive it in LaunchDarkly / delete the parameter in Remote Config.
4. Update the behavior test that flipped it.

`addedOn` and the list route (`GET …/flags`) are what a cleanup pass reads: an old flag at 100% for everyone is the
first one to go.

## Choosing and switching provider

`FLAGS_PROVIDER` picks the adapter (API configuration: `apps/api/.env` locally, the GitHub variable
`{QA,PROD}_FLAGS_PROVIDER` when deploying, `docs/DEPLOY.md`).

| `FLAGS_PROVIDER`      | Where flags are operated                      | Needs                                                                                   |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `firestore` (default) | the admin routes (`docs/API.md`), Firestore   | nothing: works with the emulators and in any project                                    |
| `launchdarkly`        | LaunchDarkly's console or API                 | an account; `LAUNCHDARKLY_SDK_KEY` as a Secret Manager secret                           |
| `remote-config`       | Firebase console → Remote Config → **Server** | the Remote Config API enabled; `roles/cloudconfig.viewer` for the Functions' runtime SA |
| `memory`              | nowhere: every flag at its default            | nothing (tests, or a deployment that wants every flag off)                              |

How each one expresses the four states:

| State      | Firestore (own)                        | LaunchDarkly                                              | Remote Config (server template)                                      |
| ---------- | -------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| off        | `DELETE` the rule, or `enabled: false` | targeting off (serves the off variation = default)        | no conditional values (parameter default: "use in-app default")      |
| everyone   | `percent: 100`                         | default rule serves the variation                         | parameter default value                                              |
| percentage | `percent`, `bucketBy: user\|workspace` | default rule: percentage rollout by `user` or `workspace` | percent condition; splits by user only (`randomizationId` = user id) |
| allow-list | `allowList.userIds` / `workspaceIds`   | individual targets on `user` / `workspace` contexts       | condition on custom signal `userId` / `workspaceId`, exact match     |

The context each adapter receives: LaunchDarkly gets a multi-context (`user` with the attributes, `workspace`);
Remote Config gets `randomizationId` (the user id) and custom signals (`userId`, `workspaceId`, the attributes as
strings). The session passes `locale` and `role` as attributes. Never put emails or names in a context.

**Switching** is configuration plus recreating the targeting: set `FLAGS_PROVIDER` (and the provider's secret or
permission), create every flag in `FLAGS` in the new tool with the same key (Remote Config: `_` instead of `-`),
reproduce the current state of each (read it with `GET …/flags`), then deploy. Until a flag exists in the new tool,
everyone gets its declared default, which is the safe side. The admin routes answer `409 FLAGS_MANAGED_ELSEWHERE`
with any provider but `firestore`.

**Dropping an adapter** you will never use: delete its folder in `packages/api-core/src/flags/`, its line in
`flags/providers.ts`, and its SDK in `packages/api-core/package.json` (LaunchDarkly: `@launchdarkly/node-server-sdk`,
plus its catalog entry in `pnpm-workspace.yaml`; Remote Config uses `firebase-admin`, which stays).

## Writing a new adapter

1. A folder `packages/api-core/src/flags/<name>/` with a class that extends `FlagsProvider`, sets `name`, and
   implements one method: `variation(key, context)` returns the raw value for that context, or `undefined` when
   nothing targets the flag. It may throw or hang: the base class handles timeouts, failures and schema checks. Read
   the flag's declaration with `this.definitionOf(key)`. Release connections in `close()`.
2. A line in `flags/providers.ts` (`'<name>': async (deps, options) => …`), loading the folder with `import()` so
   deployments that do not use it never load its SDK. Its SDK goes in `packages/api-core/package.json` through the
   catalog; if it has an install script, in `allowBuilds` too.
3. A spec next to it that calls `describeFlagsProviderContract('<name>', harness)` from
   `@app/api-core/testing/flags-provider-contract`. The harness builds a provider whose backend serves the given
   rules (expressed the way that backend does: see the LaunchDarkly and Remote Config specs) and one whose backend
   fails. Make it run offline: the vendor's test data source, a local file, a fake server.

**A new adapter is ready when it passes that spec**: same context, same variation every time; a percentage splits
roughly as configured and only grows; allow-listed users and workspaces get the variation; a disabled flag serves
the default; values that do not match the schema are ignored; a failing backend serves the defaults without
throwing; undeclared keys are refused.

## Security

- The client never reads or writes `flags/*`: `apps/api/firestore.rules` denies it (spec in
  `apps/api/src/firestore-rules/`). Only the API writes it, with the Admin SDK.
- Only owners and admins (`flags:manage`) of the workspace in `FLAGS_ADMIN_WORKSPACE_ID` operate flags. Unset means
  nobody; `*` works only in `local`. Any other workspace (a customer's) gets `403`.
- Provider keys are Secret Manager secrets, mounted only on the API (`docs/DEPLOY.md`); nothing about the provider
  reaches the web.
