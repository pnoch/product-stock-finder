# Store Listing — Product Stock Finder

Copy for App Store Connect and Google Play Console. Keep this in sync with
`app.config.ts` (name, bundle id, version) and `eas.json` (submit profiles).

## Identity

| Field | Value |
| --- | --- |
| App name | Product Stock Finder |
| iOS bundle id | `com.app.stocktrackerpro` |
| Android package | `com.app.stocktrackerpro` |
| Version | `5.16.0` (EAS `appVersionSource: remote` manages build numbers) |
| Category | Utilities |
| Price | Free |

## Short description (Play Store, 80 chars max)

> Track stock and prices across 25 electronics distributors. Alerts and history.

## Full description

> Product Stock Finder tracks product availability and prices across 25 global
> electronics distributors, with a focus on MikroTik and Ubiquiti networking
> gear.
>
> Build a watchlist, set target-price alerts, schedule back-order reminders, and
> watch for restocks. Compare price history across every distributor that
> carries a product, see the cheapest region, and get notified the moment a
> price drops or an item is back in stock.
>
> FEATURES
> • Watchlist with tags, sorting, and grouping
> • Price alerts — get notified when a price drops below your target
> • Restock watches — know the moment an item is available again
> • Back-order reminders for items on order
> • Price history charts and cross-distributor comparison
> • Distributor health dashboard showing which sites are reachable
> • 11 display currencies with live exchange rates
> • Works offline; syncs across your devices when you sign in
>
> No ads. No tracking SDKs. Your watchlist is yours.

## Keywords (App Store, 100 chars max)

> mikrotik,ubiquiti,network,switch,router,price,stock,alert,watchlist,distributor,hardware

## Support / legal URLs

| Field | Value |
| --- | --- |
| Privacy policy | `https://<web-host>/privacy` (served by the SPA; override with `EXPO_PUBLIC_PRIVACY_URL`) |
| Support email | `support@productstockfinder.savvylife.icu` (override with `EXPO_PUBLIC_SUPPORT_EMAIL`) |
| Marketing URL | `https://<web-host>/` |

## Required assets (not in the repo — supply at submission)

| Asset | Requirement |
| --- | --- |
| App icon | 1024×1024 PNG, no alpha (iOS); 512×512 (Play) |
| iPhone screenshots | 6.7" and 6.5" (1290×2796 / 1242×2688), 3–10 each |
| iPad screenshots | 12.9" (2048×2732), if `supportsTablet` stays true |
| Android screenshots | Phone + 7"/10" tablet, 2–8 each |
| Feature graphic | 1024×500 (Play) |
| App preview video | Optional |

## Data safety / privacy answers

- **Data collected:** email address, display name (optional), hashed password,
  device identifiers, and user content (watchlist/alerts/reminders).
- **Purpose:** app functionality, account management, notifications.
- **Shared with third parties:** no. Prices are fetched from public distributor
  sites; no user data is sent to them.
- **Encrypted in transit:** yes (HTTPS).
- **Deletion:** in-app via Settings → Account → Delete Account.

## Submission commands

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform android --profile production   # track: internal, draft
eas submit --platform ios --profile production       # prompts for ascAppId
```

`eas submit` for iOS needs the App Store Connect app id (`ascAppId`) and an
Apple ID / app-specific password, or an API key — EAS prompts on first run.
