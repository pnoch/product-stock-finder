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
          contentStyle={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, color: "#1f2937" }}
          cursor={{ stroke: "#0F52BA", strokeDasharray: "4 4", strokeOpacity: 0.4 }}
        />
        <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} />
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
