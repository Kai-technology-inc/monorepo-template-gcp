# @app/i18n

The language module. Full guide: [`docs/I18N.md`](../../docs/I18N.md).

| Entry                | Use from | What                                                                                              |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `@app/i18n`          | anywhere | `createTranslator`, `createFormatters`, locale config (`LOCALE_COOKIE`, `negotiateLocale`), types |
| `@app/i18n/messages` | server   | `loadMessages(locale)`: one dictionary per dynamic import                                         |
| `@app/i18n/react`    | client   | `<I18nProvider>`, `useT()`, `useFormatters()`, `useLocale()`, `<RichText>`                        |

Published as source (Next transpiles it). `pnpm turbo run typecheck test --filter=@app/i18n` checks keys,
placeholders and parity across languages.
