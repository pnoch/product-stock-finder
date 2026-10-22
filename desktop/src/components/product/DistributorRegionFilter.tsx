export function DistributorRegionFilter({
  regions,
  regionFilter,
  onRegionChange,
}: {
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {["all", ...regions].map((region) => (
        <button
          key={region}
          onClick={() => onRegionChange(region)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            regionFilter === region
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
          aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
          aria-pressed={regionFilter === region}
        >
          {region === "all" ? "All" : region}
        </button>
      ))}
    </div>
  );
}
