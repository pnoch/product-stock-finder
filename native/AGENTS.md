# OmniShop native rebuild

This is a clean Kotlin/Compose application, independent of the Expo/Tauri app.
See `README.md` for the verified feature/platform matrix and exact commands.

- Keep business rules in `core`, SQLDelight transactions in `data`, URL/source
  adapters in `connectors`, presentation in `app`, and OS APIs in entry points.
- No mandatory backend, account, token broker, telemetry, or desktop dependency.
- Use minor-unit integers for money. Unknown fees are not zero. Never silently
  merge product variants, orders, or tracking observations.
- New installs start empty. Fixtures belong in test source sets only.
- Do not mark a connector live without actual authorized requests and provenance.
- Preserve original event descriptions/timestamps and manual/provider attribution.
- Run the native tests and compile affected platforms before claiming success.
  Linux cannot prove iOS, Windows, or macOS packaging.
- The preview package is separate from the old app. Do not replace the shared
  release APK/page with this development preview without a user request.
- Never commit a local database containing user records, local.properties,
  signing keys, build output, or Gradle caches. The SQLDelight `databases/1.db`
  file is an empty schema snapshot, not an exported user database.
