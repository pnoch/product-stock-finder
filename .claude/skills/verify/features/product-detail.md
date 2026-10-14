# Product detail + price check

## Sub-features

- Distributor rows with prices, stock, and sparklines.
- Best-distributor card.
- Set price alert / remind me / watch for restock.
- Marketplace card (Shopee/Lazada/Facebook/eBay) with "Check current price".
- Price history chart; compare link.

## How to get to it (user POV)

Tap a row in **Watch**, or a search result.

## Driving it with drive.sh

```bash
D=.claude/skills/verify/scripts/drive.sh
$D tap 720 2956            # Watch tab
$D tap 720 900             # first product row
sleep 2
$D shot product-detail
$D swipe 720 2400 720 900 400   # scroll to the marketplace card
$D shot product-marketplace
```

## Observable end state

- Detail shows the product name, distributor rows, and a price chart.
- A marketplace product shows its platform, variant/seller, manual price, and a
  "Check current price" button; monitoring status is labelled honestly
  (manual / login required / automatic).
- "Check current price" either updates the price with a success haptic or shows
  a clear reason (login needed, no price, unavailable) — never a silent no-op.

## Gotchas

- Marketplace price checks run on-device through the WebView host; on web they
  are unavailable by design.
- Facebook/Shopee checks may require a session (Settings → Site sessions).
