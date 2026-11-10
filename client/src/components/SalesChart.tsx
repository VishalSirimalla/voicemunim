import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "./common";
import { money } from "../utils/format";

interface ChartRow {
  date: string;
  sales: number;
  collections: number;
}

export default function SalesChart({ data }: { data: ChartRow[] }) {
  if (data.length === 0) {
    return <EmptyState title="No activity this week" detail="Sales and collections will appear here when you record transactions." />;
  }
  return <div className="h-[250px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 10, bottom: 0 }}>
        <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d7a59" stopOpacity={0.17} /><stop offset="100%" stopColor="#0d7a59" stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#edf0ee" />
        <XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" })} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#82908a" }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#82908a" }} tickFormatter={(value: number) => value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}`} width={48} />
        <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" })} />
        <Area type="monotone" dataKey="sales" name="Sales" stroke="#0d7a59" strokeWidth={2.5} fill="url(#salesFill)" />
        <Area type="monotone" dataKey="collections" name="Collections" stroke="#75a99a" strokeWidth={2} fill="transparent" />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}
