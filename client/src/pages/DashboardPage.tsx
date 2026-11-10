import { useEffect, useState } from "react";
import { lazy, Suspense } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, CircleDollarSign, UsersRound, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/common";
import { request } from "../services/api";
import type { Product, Transaction } from "../types/api";
import { dateTime, money } from "../utils/format";

const SalesChart = lazy(() => import("../components/SalesChart"));

interface Summary {
  totalProducts: number;
  totalCustomers: number;
  totalSalesToday: number;
  totalSalesThisMonth: number;
  totalCollectionToday: number;
  totalOutstanding: number;
  lowStockProductCount: number;
  recentTransactions: Transaction[];
  recentSales: Transaction[];
  topSellingProducts: Array<{ name: string; quantitySold: number; unit: string; revenue: number }>;
}

interface ChartRow {
  date: string;
  sales: number;
  collections: number;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chart, setChart] = useState<ChartRow[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      request<Summary>("/dashboard/summary"),
      request<ChartRow[]>("/dashboard/sales-chart?period=weekly"),
      request<{ products: Product[] }>("/dashboard/low-stock?limit=5"),
    ])
      .then(([data, chartRows, stock]) => {
        setSummary(data);
        setChart(chartRows);
        setLowStock(stock.products);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Preparing your business overview…" />;
  if (error) return <ErrorNotice message={error} />;
  if (!summary) return <ErrorNotice message="Dashboard data is not available." />;

  const stats = [
    { label: "Sales today", value: money(summary.totalSalesToday), note: `${money(summary.totalSalesThisMonth)} this month`, icon: CircleDollarSign, tint: "bg-emerald-50 text-emerald-800" },
    { label: "Collected today", value: money(summary.totalCollectionToday), note: "Cash received", icon: ArrowDownRight, tint: "bg-blue-50 text-blue-700" },
    { label: "Outstanding", value: money(summary.totalOutstanding), note: "Across all customers", icon: WalletCards, tint: "bg-amber-50 text-amber-700" },
    { label: "Products", value: summary.totalProducts.toLocaleString("en-IN"), note: `${summary.lowStockProductCount} low on stock`, icon: Boxes, tint: "bg-violet-50 text-violet-700" },
  ];

  return <>
    <PageHeading eyebrow="Business overview" title="Good day, here's your shop at a glance" description="A clear view of what's happening in your business today." action={<Link to="/sales" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800">Create a sale</Link>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, note, icon: Icon, tint }) => <Card key={label} className="p-5">
        <div className="flex items-start justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${tint}`}><Icon className="h-[18px] w-[18px]" /></span></div>
        <p className="mt-4 text-[26px] font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{note}</p>
      </Card>)}
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Sales overview</h2><p className="mt-1 text-xs text-slate-500">Sales and collections · this week</p></div><Link to="/reports" className="flex items-center gap-1 text-xs font-semibold text-emerald-800">Reports <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <Suspense fallback={<Loading label="Loading sales chart…" />}><SalesChart data={chart} /></Suspense>
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Low stock</h2><p className="mt-1 text-xs text-slate-500">{summary.lowStockProductCount} products need a look</p></div><Link to="/inventory" className="text-xs font-semibold text-emerald-800">View inventory</Link></div>
        {lowStock.length === 0 ? <EmptyState title="Stock looks good" detail="Products at or below their reorder threshold appear here." /> :
          <div className="space-y-1">
            {lowStock.map((product) => <div key={product._id} className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
              <div><p className="text-sm font-medium text-slate-800">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{money(product.price)} / {product.unit}</p></div>
              <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">{product.stock} {product.unit}</span>
            </div>)}
          </div>}
      </Card>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 sm:px-6"><div><h2 className="font-semibold">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">Latest activity across your shop</p></div><Link to="/sales" className="flex items-center gap-1 text-xs font-semibold text-emerald-800">Sales history <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        {summary.recentTransactions.length === 0 ? <div className="p-5"><EmptyState title="No transactions yet" detail="New sales and payments will show up here." /></div> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Type</th><th className="px-5 py-3 font-semibold">Date</th><th className="px-5 py-3 text-right font-semibold">Amount</th></tr></thead><tbody>{summary.recentTransactions.map((transaction) => <tr key={transaction._id} className="border-t border-slate-100"><td className="px-5 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{transaction.type.replace("_", " ")}</span></td><td className="px-5 py-3 text-xs text-slate-500">{dateTime(transaction.createdAt)}</td><td className="px-5 py-3 text-right font-semibold">{money(transaction.totalAmount)}</td></tr>)}</tbody></table></div>}
      </Card>
      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Top products</h2><p className="mt-1 text-xs text-slate-500">Based on recent sales</p></div><ArrowUpRight className="h-4 w-4 text-slate-400" /></div>
        {summary.topSellingProducts.length === 0 ? <EmptyState title="No product sales yet" detail="Product performance appears after recorded sales." /> :
          <div className="space-y-4">{summary.topSellingProducts.map((product, index) => <div key={product.name} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800">{index + 1}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-sm font-medium">{product.name}</p><p className="text-sm font-semibold">{money(product.revenue)}</p></div><p className="mt-1 text-xs text-slate-500">{product.quantitySold} {product.unit} sold</p></div>
          </div>)}</div>}
        <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 p-3"><UsersRound className="h-4 w-4 text-slate-500" /><p className="text-xs text-slate-600">{summary.totalCustomers} customers in your shop</p></div>
      </Card>
    </div>
  </>;
}
