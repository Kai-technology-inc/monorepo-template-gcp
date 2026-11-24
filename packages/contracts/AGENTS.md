# @app/contracts

Layer 0: the shared model. API and web both depend on it; it imports nothing from the workspace.

- **One schema, three uses.** A zod schema here is the TypeScript type (`z.infer`), the API's request validation
  (`ZodBody(schema)`) and the web's response parsing (`callApi(..., { schema })`). Never declare the same shape twice.
- **Requests are `z.strictObject()`** (zod 4): unknown fields are rejected, so a typo in a client is an error, not silently ignored.
- **Timestamps are ISO strings**, ids are Firestore document ids (`IdSchema`).
- **Permissions, not roles.** Add a capability to `PERMISSIONS` and grant it in `ROLE_PERMISSIONS`; code checks
  permissions only.
- **Error codes** (`ERROR_CODES`) are API: adding one requires its message in every dictionary of `@app/i18n`
  (the parity spec fails otherwise). Never rename or remove one without checking the web.
- **Routes** are built with `apiRoutes`, in English kebab-case (`url-vocabulary.ts`). The API's arch spec checks the
  controllers against the same rules.
- **Locales**: `SUPPORTED_LOCALES` is the list the dictionaries must cover. See `docs/I18N.md`.
- **Feature flags** are declared in `FLAGS` (`flags.ts`): key, value type (zod) and default. A user-visible change
  ships behind one; remove it once fully rolled out. See `docs/FLAGS.md`.

Build: `tsc -b` to `dist/` (CommonJS), consumed by Nest as-is and transpiled by Next.
