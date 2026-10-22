import { useNavigate } from "react-router";
import { useHealthData } from "../hooks/use-health-data";
import { HealthSummary } from "../components/health/HealthSummary";
import { HealthDistributorList } from "../components/health/HealthDistributorList";

export function Health() {
  const navigate = useNavigate();
  const {
    health,
    stats,
    testing,
    progress,
    healthError,
    filter,
    setFilter,
    counts,
    filtered,
    resolveStatusColor,
    overallWorkingPct,
    runTest,
  } = useHealthData();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/settings")}
          className="text-blue-600 mr-3"
          aria-label="Go back to settings"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Health</h1>
      </div>

      <HealthSummary
        health={health}
        counts={counts}
        overallWorkingPct={overallWorkingPct}
        filter={filter}
        onFilterChange={setFilter}
        testing={testing}
        progress={progress}
        healthError={healthError}
        onRunTest={() => void runTest()}
      />

      <HealthDistributorList
        health={health}
        filtered={filtered}
        stats={stats}
        resolveStatusColor={resolveStatusColor}
        onOpen={(distributorId) => navigate(`/health/${distributorId}`)}
        onRunTest={() => void runTest()}
        onShowAll={() => setFilter("all")}
      />
    </div>
  );
}
