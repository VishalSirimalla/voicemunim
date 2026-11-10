import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { ArrowRight, LoaderCircle, Pencil, Plus, Search, WalletCards } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/common";
import { createIdempotencyKey, request } from "../services/api";
import type { Customer, Transaction } from "../types/api";
import { dateTime, money } from "../utils/format";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      const data = await request<{ customers: Customer[] }>(`/customers?${query}`);
      setCustomers(data.customers);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request(editing ? `/customers/${editing._id}` : "/customers", {
        method: editing ? "PUT" : "POST",
        body: { name: String(form.get("name")).trim(), phone: String(form.get("phone")).trim() },
      });
      setFormOpen(false);
      setEditing(null);
      setNotice(editing ? "Customer details updated." : "Customer added.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save customer.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeading eyebrow="Customers" title="People who keep your shop going" description="Manage customer details and open their account ledger." action={<button onClick={() => { setEditing(null); setFormOpen(true); setNotice(""); }} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Plus className="h-4 w-4" /> Add customer</button>} />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <Card>
      <div className="border-b border-slate-200 p-4"><label className="relative block max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by customer name…" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" /></label></div>
      {loading ? <Loading label="Loading customers…" /> : customers.length === 0 ? <div className="p-5"><EmptyState title={search ? "No matching customers" : "No customers yet"} detail={search ? "Try another name." : "Add a customer to keep their details and account ledger together."} /></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[590px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5 font-semibold">Customer</th><th className="px-4 py-3.5 font-semibold">Phone</th><th className="px-5 py-3.5 text-right font-semibold">Actions</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer._id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold">{customer.name}</p><p className="mt-0.5 text-xs text-slate-500">Customer account</p></td><td className="px-4 py-4 text-slate-600">{customer.phone}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => { setEditing(customer); setFormOpen(true); setNotice(""); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Edit customer"><Pencil className="h-4 w-4" /></button><Link to={`/ledger/${customer._id}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">Ledger <ArrowRight className="h-3.5 w-3.5" /></Link></div></td></tr>)}</tbody></table></div>}
    </Card>
    {formOpen && <Modal title={editing ? "Edit customer" : "Add customer"} onClose={() => setFormOpen(false)}><form onSubmit={save} className="space-y-4">
      <Input label="Customer name" name="name" defaultValue={editing?.name} required maxLength={120} />
      <Input label="Phone number" name="phone" type="tel" defaultValue={editing?.phone} required minLength={7} maxLength={20} pattern="[+]?[0-9 ()-]{7,20}" />
      <p className="text-xs text-slate-500">Phone numbers must be valid and unique within this shop.</p>
      <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Cancel</button><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Add customer"}</button></div>
    </form></Modal>}
  </>;
}

interface LedgerData {
  customer: Customer;
  balance: number;
  transactions: Transaction[];
}

export function LedgerPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (customerId) {
        const [data, customersData] = await Promise.all([
          request<LedgerData>(`/customers/${customerId}/ledger?limit=100`),
          request<{ customers: Customer[] }>("/customers?limit=100"),
        ]);
        setLedger(data);
        setCustomers(customersData.customers);
      } else {
        const data = await request<{ customers: Customer[] }>("/customers?limit=100");
        setCustomers(data.customers);
        setLedger(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load the customer ledger.");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ledger) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/payments", {
        method: "POST",
        idempotencyKey: createIdempotencyKey(),
        body: {
          customerId: ledger.customer._id,
          amount: Number(form.get("amount")),
          paymentMethod: String(form.get("paymentMethod")),
        },
      });
      setPaymentOpen(false);
      setNotice("Payment recorded and applied to outstanding sales.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record payment.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeading eyebrow="Udhar ledger" title={ledger ? ledger.customer.name : "Customer balances"} description={ledger ? `Account activity and outstanding balance for ${ledger.customer.phone}.` : "Choose a customer to view account balance and payment history."} action={ledger && ledger.balance > 0 ? <button onClick={() => { setPaymentOpen(true); setNotice(""); }} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><WalletCards className="h-4 w-4" /> Record payment</button> : undefined} />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <Loading label="Loading ledger…" /> : ledger ? <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-slate-500">Outstanding balance</p><p className="mt-2 text-2xl font-bold text-slate-900">{money(ledger.balance)}</p><p className="mt-1 text-xs text-slate-500">Unpaid amount across sales</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Customer</p><p className="mt-2 text-lg font-bold">{ledger.customer.name}</p><p className="mt-1 text-xs text-slate-500">{ledger.customer.phone}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Transactions</p><p className="mt-2 text-2xl font-bold">{ledger.transactions.length}</p><p className="mt-1 text-xs text-slate-500">Latest entries shown below</p></Card>
      </div>
      <Card><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">Transaction history</h2></div>
        {ledger.transactions.length === 0 ? <div className="p-5"><EmptyState title="No ledger activity" detail="Sales and payments for this customer will appear here." /></div> :
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5 font-semibold">Transaction</th><th className="px-4 py-3.5 font-semibold">Date</th><th className="px-4 py-3.5 font-semibold">Status</th><th className="px-5 py-3.5 text-right font-semibold">Amount</th></tr></thead><tbody>{ledger.transactions.map((transaction) => <tr key={transaction._id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-semibold">{transaction.type === "SALE" ? "Sale" : transaction.type === "PAYMENT" ? "Payment received" : transaction.type.replace("_", " ")}</p><p className="mt-0.5 text-xs text-slate-500">{transaction.items?.length ? `${transaction.items.length} item${transaction.items.length === 1 ? "" : "s"}` : "Customer account"}</p></td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(transaction.createdAt)}</td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{transaction.paymentStatus || transaction.paymentMethod || "Recorded"}</span></td><td className="px-5 py-4 text-right font-semibold">{money(transaction.totalAmount)}</td></tr>)}</tbody></table></div>}
      </Card>
    </> : customers.length === 0 ? <Card className="p-5"><EmptyState title="No customer accounts yet" detail="Add a customer before tracking outstanding balances." action={<Link className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white" to="/customers">Go to customers</Link>} /></Card> :
      <Card><div className="divide-y divide-slate-100">{customers.map((customer) => <button key={customer._id} onClick={() => navigate(`/ledger/${customer._id}`)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"><span><span className="block text-sm font-semibold">{customer.name}</span><span className="mt-0.5 block text-xs text-slate-500">{customer.phone}</span></span><ArrowRight className="h-4 w-4 text-slate-400" /></button>)}</div></Card>}
    {paymentOpen && ledger && <Modal title={`Record payment · ${ledger.customer.name}`} onClose={() => setPaymentOpen(false)}><form onSubmit={recordPayment} className="space-y-4">
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Outstanding: <strong>{money(ledger.balance)}</strong></p>
      <Input label="Amount received (₹)" name="amount" type="number" min="0.01" max={ledger.balance} step="0.01" required />
      <label className="block text-sm font-medium text-slate-700">Payment method<select name="paymentMethod" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label>
      <p className="text-xs text-slate-500">Payment is applied to the customer's oldest outstanding sales first. This action cannot be undone.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Cancel</button><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Confirm payment</button></div>
    </form></Modal>}
  </>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">×</button></div>{children}</div></div>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" {...props} /></label>;
}
