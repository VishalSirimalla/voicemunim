import { useCallback, useEffect, useState } from "react";
import { BarChart3, CalendarDays, FileText } from "lucide-react";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/common";
import { request } from "../services/api";
import { money } from "../utils/format";

type ReportKey = "daily" | "sales" | "collections" | "outstanding" | "inventory" | "top-products" | "low-stock";

const reports: Array<{ key: ReportKey; label: string; description: string; dated?: boolean }> = [
  { key: "daily", label: "Daily summary", description: "Sales and collections for today." },
  { key: "sales", label: "Sales", description: "Sales and outstanding for a selected period.", dated: true },
  { key: "collections", label: "Collections", description: "Amounts received, grouped by date.", dated: true },
  { key: "outstanding", label: "Outstanding", description: "Customer-wise unpaid balances." },
  { key: "inventory", label: "Inventory", description: "Stock quantities and inventory value." },
  { key: "top-products", label: "Top products", description: "Best-selling products for a selected period.", dated: true },
  { key: "low-stock", label: "Low stock", description: "Products at or below their stock threshold." },
];

export function ReportsPage() {
  const [selected, setSelected] = useState<ReportKey>("daily");
  const [period, setPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const current = reports.find((report) => report.key === selected)!;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const query = new URLSearchParams();
      if (selected === "inventory" || selected === "low-stock") {
        query.set("page", "1");
        query.set("limit", "100");
      }
      if (selected === "top-products") query.set("limit", "20");
      if (current.dated) {
        if (startDate || endDate) {
          if (!startDate || !endDate) throw new Error("Choose both a start date and an end date.");
          query.set("startDate", startDate);
          query.set("endDate", endDate);
        } else {
          query.set("period", period);
        }
      }
      const result = await request<unknown>(`/reports/${selected}${query.size ? `?${query}` : ""}`);
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this report.");
    } finally {
      setLoading(false);
    }
  }, [selected, current.dated, startDate, endDate, period]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <>
    <PageHeading eyebrow="Reports" title="Know your numbers" description="Explore sales, collections, balances, and inventory from your shop records." />
    <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {reports.map((report) => <button key={report.key} onClick={() => setSelected(report.key)} className={`rounded-xl border p-3 text-left transition ${selected === report.key ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}><span className="flex items-center gap-2 text-sm font-semibold"><FileText className={`h-4 w-4 ${selected === report.key ? "text-emerald-700" : "text-slate-400"}`} />{report.label}</span><span className="mt-1 block text-xs text-slate-500">{report.description}</span></button>)}
    </div>
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 p-5">
        <div><div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-emerald-700" /><h2 className="font-semibold">{current.label} report</h2></div><p className="mt-1 text-xs text-slate-500">{current.description}</p></div>
        <div className="flex flex-wrap items-end gap-2">
          {current.dated && <>
            <label className="text-xs font-medium text-slate-600">Period<select value={period} disabled={!!(startDate || endDate)} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm disabled:opacity-50"><option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This month</option></select></label>
            <label className="text-xs font-medium text-slate-600"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />From</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-slate-600">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-2 text-sm" /></label>
            {(startDate || endDate) && <button onClick={() => { setStartDate(""); setEndDate(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium">Clear dates</button>}
          </>}
          <button onClick={() => void load()} className="rounded-lg bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Apply filters</button>
        </div>
      </div>
      <div className="p-5">
        {error && <ErrorNotice message={error} />}
        {loading ? <Loading label="Loading report…" /> : data === null ? null : <ReportResult value={data} />}
      </div>
    </Card>
  </>;
}

function ReportResult({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return value.length ? <DataTable rows={value} /> : <EmptyState title="No report rows" detail="There is no recorded activity for this selection yet." />;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !isInternalField(key));
    const arrays = entries.filter(([, item]) => Array.isArray(item));
    const scalar = entries.filter(([, item]) => item === null || typeof item !== "object");
    const nested = entries.filter(([, item]) => item && typeof item === "object" && !Array.isArray(item));
    return <div className="space-y-5">
      {scalar.length > 0 && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{scalar.map(([key, item]) => <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-medium capitalize text-slate-500">{labelize(key)}</p><p className="mt-1.5 break-words text-lg font-bold text-slate-900">{displayFieldValue(key, item)}</p></div>)}</div>}
      {nested.map(([key, item]) => {
        const fields = Object.entries(item as Record<string, unknown>).filter(([childKey]) => !isInternalField(childKey));
        return fields.length > 0 && <div key={key}><h3 className="mb-2 text-sm font-semibold capitalize">{labelize(key)}</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{fields.map(([childKey, child]) => <div key={childKey} className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{labelize(childKey)}</p><p className="mt-1 text-base font-semibold">{displayFieldValue(childKey, child)}</p></div>)}</div></div>;
      })}
      {arrays.map(([key, rows]) => <div key={key}><h3 className="mb-2 text-sm font-semibold capitalize">{labelize(key)}</h3>{(rows as unknown[]).length ? <DataTable rows={rows as unknown[]} /> : <EmptyState title={`No ${labelize(key).toLowerCase()}`} detail="No entries are available for this report." />}</div>)}
      {!entries.length && <EmptyState title="No report data" detail="There is no data for this report yet." />}
    </div>;
  }
  return <p className="text-sm text-slate-500">{displayValue(value)}</p>;
}

function DataTable({ rows }: { rows: unknown[] }) {
  const normalized = rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row));
  if (!normalized.length) return <EmptyState title="No report rows" detail="There is no recorded activity for this selection yet." />;
  const columns = [...new Set(normalized.flatMap((row) => Object.keys(row).filter((key) => !isInternalField(key))))].slice(0, 7);
  if (!columns.length) return <EmptyState title="No report rows" detail="There is no recorded activity for this selection yet." />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{labelize(column)}</th>)}</tr></thead><tbody>{normalized.map((row, index) => <tr key={String(row._id ?? row.customerId ?? row.productId ?? index)} className="border-t border-slate-100">{columns.map((column) => <td key={column} className="max-w-64 truncate px-4 py-3 text-slate-700">{displayFieldValue(column, row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function labelize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim(); }
function isInternalField(field: string) { return field === "_id" || /(?:Id|ID|_id)$/.test(field); }
function displayFieldValue(field: string, value: unknown): string {
  const currencyField = /amount|revenue|outstanding|collection|inventorycost|total/i.test(field);
  return typeof value === "number" && currencyField ? money(value) : displayValue(value);
}
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value > 10000 ? money(value) : value.toLocaleString("en-IN");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (!Array.isArray(value)) return "Details";
    const items = value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item));
    if (items.length) {
      return items.map((item) => {
        const name = item.productName ?? item.name;
        const quantity = item.quantity;
        const unit = item.unit;
        if (typeof name !== "string") return "Item";
        return `${name}${typeof quantity === "number" ? ` · ${quantity}${typeof unit === "string" && unit ? ` ${unit}` : ""}` : ""}`;
      }).join(", ");
    }
    return `${value.length} items`;
  }
  return String(value);
}
