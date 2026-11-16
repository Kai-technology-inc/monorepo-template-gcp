# @app/web-platform

The product's screens: sign-in and registration, the app shell, dashboard, members and settings. Built on
`@app/web-kit`, `@app/i18n` and `@app/contracts`; `apps/web` only routes to them.

| Folder                    | Screens                                                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`                   | `LoginForm`, `RegisterForm` (new account, from an invitation, or finishing registration), `ForgotPasswordForm`, `VerifyEmailScreen`, `AuthActionScreen` (Firebase email links land here: `/auth/action`) |
| `invitations/`            | `AcceptInvitationScreen` (wired) and `AcceptInvitationView` (pure: what each state says)                                                                                                                 |
| `shell/`                  | `AppShell` (navigation; add your module's entry here), `AuthGate`, `WorkspaceSwitcher`                                                                                                                   |
| `members/`                | `MembersScreen`, `InviteForm`, `PendingInvitations`                                                                                                                                                      |
| `dashboard/`, `settings/` | `DashboardScreen`, `SettingsScreen` (profile, language, workspace)                                                                                                                                       |
| `lib/`                    | the decisions screens lean on, as pure functions with specs: `gateDecision` (who may see an app page), `member-rules`                                                                                    |

## Rules of thumb

- **Decisions are functions, screens are wiring.** A rule a screen applies (who sees a page, which roles can be
  assigned) goes in `lib/` with a spec; the API enforces the same rule, the screen only mirrors it so it never offers
  a refused action.
- **Every text through `t()`** (`react/jsx-no-literals` fails the lint otherwise); keys per screen
  (`members.invite.submit`).
- A new product area gets its own web package (`web-projects`), not a folder here: see
  [`docs/EXTENDING.md`](../../docs/EXTENDING.md).

Tests: `pnpm turbo run test --filter=@app/web-platform`.
