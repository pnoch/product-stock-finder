# Correctness Bundle 3 — Design Spec (2026-09-10)

Six verified items: logout UX delay, two silent failure paths, alert-creation drift, render-time recompute, missing crash boundary. No success-path behavior change except instant sign-out UI.

## §A — UI-first logout

Reorder `logout`: `clearUserInfo()` + `notify()` first (instant UI), then awaited bounded unregister (token still stored → authenticated), then `removeSessionToken()`. Failure sets retry flag. Callers unchanged. Test: UI instant, token present at mutate, storage cleared after.

## §B — Audible failures

Tauri invoke catch logs the cause before web fallback; manual-add discovery catch distinguishes empty-result toast ("Added with no listings — discovery failed"). Best-effort creation kept. Tests: logged cause, toast copy.

## §C — Shared alert helper + unique ids

Extract `createPriceAlert` (gate + add + toast) with `alert-${Date.now()}-${random6}` ids; four sites delegate with modal wording. Test: double-tap distinctness + shape.

## §D — Memoized derivations

Trend/lowest/converter IIFEs → `useMemo` on their inputs. No value change; existing suites green unmodified.

## §E — Desktop error boundary

Shared boundary around the router outlet, mobile fallback copy (message + retry → reset + home). Test: fallback renders, retry recovers.

## Non-goals

- Settings rollback (dropped by design, self-heals); push TTL; mobile changes.
