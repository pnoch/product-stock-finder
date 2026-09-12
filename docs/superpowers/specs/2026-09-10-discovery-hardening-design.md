# Discovery Hardening — Design Spec (2026-09-10)

Manual-add discovery is unbounded, silent, and triplicated. One shared helper with deadline + surfaced errors; UI messaging stays at call sites.

## §A — Bounded discovery

`withTimeout(..., 15_000)` (mobile's `DISCOVER_TIMEOUT_MS`) around `discoverListings` at both desktop sites; timeout is distinguishable; Add re-enables; late results discarded (mechanism in planning). Test: hung run unblocks with timeout toast, no late write.

## §B — Surfaced discovery errors

Timeout vs network/other distinguished (mobile `message === "timeout"` branch + page `discoverError` pattern); timeout gets Retry re-running discovery for the created product; creation always kept. Test: timeout toast + retry; error logged.

## §C — Shared `manualAddProduct`

`lib/` helper (slug-guard + add + bounded discovery + update) returning `{status, discovered, timedOut}`; all three flows delegate; success paths identical. Tests: root units + existing suites green.

## Non-goals

- Parse changes; new discovery sources; mobile UI changes beyond delegation.
