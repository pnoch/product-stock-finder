# Product Stock Finder — feature map

The maintained verification source. Each file describes one user-facing feature:
what it is, how to reach it, how to drive it with `scripts/drive.sh`, and the
observable end state that proves it works.

A proof that drives one convenient entry point is incomplete when the map lists
others. Keep this honest as the app changes (`/maintain-verification-skill`).

## Features

| Feature | File | Entry point |
| --- | --- | --- |
| Discover search (catalog + marketplaces) | [discover-search.md](discover-search.md) | Discover tab |
| Watchlist | [watchlist.md](watchlist.md) | Watch tab |
| Product detail + price check | [product-detail.md](product-detail.md) | tap a watchlist row |
| Alerts + reminders | [alerts.md](alerts.md) | Alerts tab |
| Concierge onboarding | [onboarding.md](onboarding.md) | first launch |
