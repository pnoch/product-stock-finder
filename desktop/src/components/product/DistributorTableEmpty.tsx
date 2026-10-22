export function DistributorTableEmpty({
  regionFilter,
  productListingsCount,
  findingPrices,
  onRegionChange,
  onFindPrices,
}: {
  regionFilter: string;
  productListingsCount: number;
  findingPrices: boolean;
  onRegionChange: (region: string) => void;
  onFindPrices: () => void;
}) {
  return (
    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {regionFilter !== "all" ? (
        <>
          <p>{`No distributors in ${regionFilter}.`}</p>
          <button
            onClick={() => onRegionChange("all")}
            className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            aria-label="Show all regions"
          >
            Show All
          </button>
        </>
      ) : productListingsCount === 0 ? (
        <>
          <p>No distributor listings available.</p>
          <button
            onClick={onFindPrices}
            disabled={findingPrices}
            className="mt-3 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60"
            aria-label="Find prices"
          >
            {findingPrices ? "Finding prices…" : "Find prices"}
          </button>
        </>
      ) : (
        "No distributor listings available."
      )}
    </div>
  );
}
