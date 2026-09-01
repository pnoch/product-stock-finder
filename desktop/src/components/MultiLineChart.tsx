import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Record<string, string | number>[];
  distributors: string[];
  colors: string[];
  currencySymbol?: string;
}

export function MultiLineChart({ data, distributors, colors, currencySymbol = "$" }: Props) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#e5e7eb"
          className="dark:opacity-20"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={{ stroke: "#d1d5db" }}
          axisLine={{ stroke: "#d1d5db" }}
          label={{
            value: "Date",
            position: "insideBottom",
            offset: -10,
            style: { fontSize: 12, fill: "#6b7280", fontWeight: 500 },
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={{ stroke: "#d1d5db" }}
          axisLine={{ stroke: "#d1d5db" }}
          label={{
            value: "Price",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "#6b7280", fontWeight: 500 },
          }}
          tickFormatter={(v: number) => `${currencySymbol}${v}`}
        />
        <Tooltip
          cursor={{ stroke: "#0F52BA", strokeDasharray: "4 4", strokeOpacity: 0.3 }}
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;
            return (
              <div className="rounded-xl border bg-white shadow-lg px-3 py-2 text-xs" style={{ borderColor: "#e5e7eb" }}>
                <p className="font-semibold text-gray-700 mb-1">{label}</p>
                {payload.map((entry: any, idx: number) => (
                  <p key={idx} className="flex items-center gap-2 animate-fadeIn" style={{ animationDelay: `${idx * 45}ms` } as React.CSSProperties}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-500 truncate max-w-[110px]">{entry.name}</span>
                    <span className="font-semibold text-gray-900 ml-auto">{currencySymbol}{Number(entry.value).toFixed(2)}</span>
                  </p>
                ))}
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ paddingTop: 14, fontSize: 12 }}
          content={({ payload }) => (
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {(payload ?? []).map((entry: any, idx: number) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-white shadow-sm" style={{ borderColor: "#e5e7eb", color: "#374151" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  {entry.value}
                </span>
              ))}
            </div>
          )}
        />
        {distributors.map((d, i) => (
          <Line
            key={d}
            type="monotone"
            dataKey={d}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 1, fill: colors[i % colors.length] }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
