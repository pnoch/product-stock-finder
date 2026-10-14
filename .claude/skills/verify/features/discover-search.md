# Discover search

## Sub-features

- Catalog search (model number, brand, name) over the static catalog + discovered products.
- eBay listings section: live offers for the query, each with a Track button.
- Facebook Marketplace section: session-gated; shows sign-in guidance when not connected.
- Trending matches: trending products matching the query, with Add.
- Category / Brand filters (collapsed behind a "Filters" toggle while searching).
- Sort: relevance, name, brand, price.
- "Discover with AI" fallback for a query with no catalog match.

## How to get to it (user POV)

Bottom tab **Discover**. Type in the search field at the top. Results replace the
browse content (Trending + Available) once the query is non-empty.

## Driving it with drive.sh

```bash
D=.claude/skills/verify/scripts/drive.sh
$D tap 430 2956            # Discover tab
$D tap 720 453             # focus the search field
$D text "dgx spark"
sleep 3
$D key 111                 # dismiss keyboard
$D swipe 720 2400 720 700 400
$D shot discover-dgx
```

## Observable end state

- The eBay listings section shows offers (image, title, price, condition,
  seller) or an honest "Could not search eBay" with Retry. It must never show
  "No eBay matches" for a failed search.
- A trending product the user can see in Trending (e.g. "NVIDIA DGX Spark") is
  findable by search and appears under "Trending matches" with an Add button.
- The empty state reads "No catalog matches" (not "No results") when
  marketplace sections rendered, and points to the results above.
- Category/Brand chips are collapsed behind a "Filters" toggle while searching.

## Gotchas

- Server-backed sections (eBay, Facebook) require the API server + `adb reverse
  tcp:3000`. A release build with a loopback API URL runs Local mode and shows
  "Could not search eBay" for every query.
- The eBay search needs `PSF_BROWSER_HEADED=1` on the server; headless is
  blocked by eBay.
- Facebook search needs a signed-in session in the app browser; without it the
  section shows sign-in guidance, not results.
