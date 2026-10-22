import { Link } from "react-router";
import { formatPrice } from "@shared/currency";
import { dealBandLabel, type RankedDeal } from "../../../../lib/deal-score";
import type { DigestResult } from "../../../../lib/price-digest";

export function DigestCard({
  digest,
  digestFrequency,
  digestPending,
  displayCurrency,
  topDeals,
}: {
  digest: DigestResult | null;
  digestFrequency: string;
  digestPending: boolean;
  displayCurrency: string;
  topDeals: RankedDeal[];
}) {
  if (digestFrequency === "off") {
    return (
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm text-gray-500 dark:text-gray-400">Digest off</p>
        <p className="text-sm text-gray-400 mt-2">Enable daily or weekly price digests to see changes here.</p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          aria-label="Go to Settings"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  if (digestPending) {
    return (
      <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
        <p className="text-sm text-gray-500 dark:text-gray-400">Digest scheduled</p>
        <p className="text-sm text-gray-400 mt-2">Your first digest will appear here once it&apos;s sent.</p>
      </div>
    );
  }

  if (!digest) return null;

  return (
    <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors duration-150">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Digest — {digestFrequency === "weekly" ? "this week" : "today"}
      </p>
      {digest.valueDelta && (
        <p className="text-sm mt-1">
          <span className="text-gray-500 dark:text-gray-400">
            {formatPrice(digest.valueDelta.from, displayCurrency)} →{" "}
            {formatPrice(digest.valueDelta.to, displayCurrency)}
          </span>{" "}
          <span
            className={
              digest.valueDelta.percent >= 0
                ? "font-bold text-red-600"
                : "font-bold text-emerald-600"
            }
          >
            {digest.valueDelta.percent >= 0 ? "+" : ""}
            {digest.valueDelta.percent.toFixed(1)}%
          </span>
        </p>
      )}
      {digest.priceChanges.length === 0 &&
      digest.stockChanges.length === 0 &&
      digest.alertTargetsHit.length === 0 &&
      digest.newProducts.length === 0 &&
      digest.removedProducts.length === 0 ? (
        <p className="text-sm text-gray-400 mt-2">No changes in this period.</p>
      ) : (
        <div className="mt-2 space-y-2 text-sm">
          {digest.priceChanges.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Price Changes</p>
              {digest.priceChanges.slice(0, 3).map((c) => (
                <p key={c.productId} className="text-gray-600 dark:text-gray-400">
                  <span className="text-gray-900 dark:text-gray-100">{c.name}</span>{" "}
                  {formatPrice(c.from, displayCurrency)} →{" "}
                  {formatPrice(c.to, displayCurrency)}{" "}
                  <span
                    className={
                      c.percent > 0
                        ? "font-semibold text-red-600"
                        : "font-semibold text-emerald-600"
                    }
                  >
                    {c.percent > 0 ? "+" : ""}
                    {c.percent.toFixed(0)}%
                  </span>
                </p>
              ))}
              {digest.priceChanges.length > 3 && (
                <p className="text-xs text-gray-400">+{digest.priceChanges.length - 3} more</p>
              )}
            </div>
          )}
          {topDeals.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Best time to buy
              </p>
              {topDeals.map((d) => (
                <Link
                  key={d.productId}
                  to={`/product/${d.productId}`}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                  aria-label={`View ${d.name} details`}
                >
                  <span className="text-gray-900 dark:text-gray-100 truncate flex-1">
                    {d.name}
                  </span>{" "}
                  <span className="text-gray-500 dark:text-gray-400">{d.score}</span>{" "}
                  <span
                    className={
                      d.band === "hot"
                        ? "font-semibold text-emerald-600"
                        : d.band === "fair"
                          ? "font-semibold text-amber-600"
                          : "font-semibold text-gray-400"
                    }
                  >
                    {dealBandLabel(d.band)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {digest.stockChanges.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Stock Changes</p>
              {digest.stockChanges.slice(0, 3).map((s) => (
                <p key={s.productId} className="text-gray-600 dark:text-gray-400">
                  <span className="text-gray-900 dark:text-gray-100">{s.name}</span>: {s.from} → {s.to}
                </p>
              ))}
              {digest.stockChanges.length > 3 && (
                <p className="text-xs text-gray-400">+{digest.stockChanges.length - 3} more</p>
              )}
            </div>
          )}
          {digest.alertTargetsHit.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Targets Hit</p>
              {digest.alertTargetsHit.slice(0, 3).map((t) => (
                <p key={t.alertId} className="text-gray-600 dark:text-gray-400">
                  <span className="text-gray-900 dark:text-gray-100">{t.name}</span> at{" "}
                  {formatPrice(t.price, t.currency)}
                </p>
              ))}
              {digest.alertTargetsHit.length > 3 && (
                <p className="text-xs text-gray-400">+{digest.alertTargetsHit.length - 3} more</p>
              )}
            </div>
          )}
          {digest.newProducts.length > 0 && (
            <div>
              {digest.newProducts.slice(0, 3).map((p) => (
                <p key={p.productId} className="text-gray-600 dark:text-gray-400">
                  + <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                </p>
              ))}
              {digest.newProducts.length > 3 && (
                <p className="text-xs text-gray-400">+{digest.newProducts.length - 3} more</p>
              )}
            </div>
          )}
          {digest.removedProducts.length > 0 && (
            <div>
              {digest.removedProducts.slice(0, 3).map((p) => (
                <p key={p.productId} className="text-gray-600 dark:text-gray-400">
                  − <span className="text-gray-900 dark:text-gray-100">{p.name}</span>
                </p>
              ))}
              {digest.removedProducts.length > 3 && (
                <p className="text-xs text-gray-400">+{digest.removedProducts.length - 3} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
