import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Eye, LoaderCircle, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/common";
import { createIdempotencyKey, request } from "../services/api";
import type { Customer, Product, Transaction } from "../types/api";
import { dateTime, money } from "../utils/format";

interface CartItem {
  product: Product;
  quantity: number;
}

export function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Transaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productData, customerData, saleData] = await Promise.all([
        request<{ products: Product[] }>("/products?limit=100"),
        request<{ customers: Customer[] }>("/customers?limit=100"),
        request<{ sales: Transaction[] }>("/sales?limit=50"),
      ]);
      setProducts(productData.products);
      setCustomers(customerData.customers);
      setSales(saleData.sales);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load sales workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [cart]);

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    const product = products.find((candidate) => candidate._id === productId);
    const amount = Number(quantity);
    if (!product) return;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setError("Enter a quantity greater than zero and no more than 100,000.");
      return;
    }
    const next = Math.round(amount * 1000) / 1000;
    const existing = cart.find((item) => item.product._id === product._id);
    const requested = Math.round(((existing?.quantity ?? 0) + next) * 1000) / 1000;
    if (requested > product.stock) {
      const available = Math.max(0, product.stock - (existing?.quantity ?? 0));
      setError(`Only ${available} ${product.unit} of ${product.name} available to add.`);
      return;
    }
    setError("");
    if (existing) {
      setCart((current) => current.map((item) =>
        item.product._id === product._id ? { ...item, quantity: requested } : item
      ));
    } else {
      setCart((current) => [...current, { product, quantity: next }]);
    }
    setProductId("");
    setQuantity("1");
  };

  const changeQuantity = (id: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    const rounded = Math.round(value * 1000) / 1000;
    const item = cart.find((candidate) => candidate.product._id === id);
    if (item && rounded > item.product.stock) {
      setError(`Only ${item.product.stock} ${item.product.unit} of ${item.product.name} available.`);
      return;
    }
    setError("");
    setCart((current) => current.map((item) => item.product._id === id ? { ...item, quantity: rounded } : item));
  };

  const createSale = async () => {
    const paid = amountPaid === "" ? 0 : Number(amountPaid);
    if (paid < 0 || paid > total) {
      setError("Amount received must be between zero and the sale total.");
      return;
    }
    if (paid < total && !customerId) {
      setError("Select a customer for unpaid or partially paid sales.");
      return;
    }
    if (paid === 0 && amountPaid !== "") {
      setError("Enter a positive amount or leave the amount received empty.");
      return;
    }
    const unavailableItem = cart.find(({ product, quantity: itemQuantity }) => {
      const currentProduct = products.find((candidate) => candidate._id === product._id);
      return !currentProduct || itemQuantity > currentProduct.stock;
    });
    if (unavailableItem) {
      const currentProduct = products.find((candidate) => candidate._id === unavailableItem.product._id);
      setError(
        currentProduct
          ? `Only ${currentProduct.stock} ${currentProduct.unit} of ${currentProduct.name} available.`
          : `${unavailableItem.product.name} is no longer available.`
      );
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        ...(customerId && { customerId }),
        items: cart.map(({ product, quantity: itemQuantity }) => ({ productId: product._id, quantity: itemQuantity })),
        ...(paid > 0 && { amountPaid: paid, paymentMethod }),
      };
      await request<Transaction>("/sales", {
        method: "POST",
        body,
        idempotencyKey: createIdempotencyKey(),
      });
      setNotice("Sale recorded successfully. Inventory has been updated.");
      setConfirmOpen(false);
      setCart([]);
      setCustomerId("");
      setAmountPaid("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not record this sale.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const viewSale = async (sale: Transaction) => {
    setSelectedSale(sale);
    try {
      const full = await request<Transaction>(`/sales/${sale._id}`);
      setSelectedSale(full);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load sale details.");
    }
  };

  if (loading) return <Loading label="Loading sales workspace…" />;

  return <>
    <PageHeading eyebrow="Sales & billing" title="Create a sale" description="Build a bill and confirm it before stock is adjusted." />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><ShoppingBasket className="h-5 w-5" /></span><div><h2 className="font-semibold">New bill</h2><p className="text-xs text-slate-500">Prices are taken from your product list.</p></div></div>
        <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-[1fr_125px_auto]">
          <label className="text-xs font-medium text-slate-600">Product<select value={productId} onChange={(event) => setProductId(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Select a product</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} · {money(product.price)}/{product.unit} · {product.stock} in stock</option>)}</select></label>
          <label className="text-xs font-medium text-slate-600">Quantity<input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} min="0.001" max="100000" step="0.001" required className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
          <button className="mt-auto flex h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> Add</button>
        </form>
        <div className="mt-5 border-t border-slate-100 pt-4">
          {cart.length === 0 ? <EmptyState title="Bill is empty" detail="Choose a product and add it to this sale." /> :
            <div className="space-y-2">{cart.map(({ product, quantity: itemQuantity }) => <div key={product._id} className="grid grid-cols-[1fr_90px_95px_32px] items-center gap-3 rounded-xl border border-slate-100 px-3 py-3">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{money(product.price)} / {product.unit}</p></div>
              <input aria-label={`${product.name} quantity`} type="number" min="0.001" max="100000" step="0.001" value={itemQuantity} onChange={(event) => changeQuantity(product._id, Number(event.target.value))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <p className="text-right text-sm font-semibold">{money(product.price * itemQuantity)}</p>
              <button onClick={() => setCart((current) => current.filter((item) => item.product._id !== product._id))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove ${product.name}`}><Trash2 className="h-4 w-4" /></button>
            </div>)}</div>}
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">Payment details</h2>
        <p className="mt-1 text-xs text-slate-500">A customer is required for credit or partial payment.</p>
        <label className="mt-5 block text-sm font-medium text-slate-700">Customer (required for balance due)<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"><option value="">Walk-in customer</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.name} · {customer.phone}</option>)}</select></label>
        <label className="mt-4 block text-sm font-medium text-slate-700">Amount received (₹)<input type="number" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} min="0" max={total} step="0.01" placeholder="Leave blank for full credit" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" /></label>
        {Number(amountPaid) > 0 && <label className="mt-4 block text-sm font-medium text-slate-700">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="OTHER">Other</option></select></label>}
        <div className="mt-6 border-t border-slate-200 pt-4"><div className="flex justify-between text-sm text-slate-500"><span>Items</span><span>{cart.length}</span></div><div className="mt-2 flex justify-between text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>{Number(amountPaid) > 0 && <div className="mt-2 flex justify-between text-sm text-slate-500"><span>Due after payment</span><span>{money(Math.max(0, total - Number(amountPaid)))}</span></div>}</div>
        <button onClick={() => { setError(""); setConfirmOpen(true); }} disabled={!cart.length || busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" /> Review and confirm sale</button>
      </Card>
    </div>
    <div className="mt-7"><PageHeading eyebrow="History" title="Recent sales" description="The latest recorded sales in this shop." /></div>
    <Card>
      {sales.length === 0 ? <div className="p-5"><EmptyState title="No sales yet" detail="Your recorded sales will appear here." /></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5 font-semibold">Sale</th><th className="px-4 py-3.5 font-semibold">Date</th><th className="px-4 py-3.5 font-semibold">Payment</th><th className="px-5 py-3.5 text-right font-semibold">Total</th><th className="px-5 py-3.5 text-right font-semibold">Details</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale._id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-semibold">Sale #{sale._id.slice(-6).toUpperCase()}</p><p className="mt-0.5 text-xs text-slate-500">{sale.items?.length ?? 0} items</p></td><td className="px-4 py-4 text-xs text-slate-500">{dateTime(sale.createdAt)}</td><td className="px-4 py-4"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{sale.paymentStatus || "Recorded"}</span></td><td className="px-5 py-4 text-right font-semibold">{money(sale.totalAmount)}</td><td className="px-5 py-4 text-right"><button onClick={() => void viewSale(sale)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="View sale"><Eye className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>}
    </Card>
    {confirmOpen && <Modal title="Confirm this sale" onClose={() => setConfirmOpen(false)}>
      <p className="text-sm text-slate-600">Please review before recording. This will update stock and cannot be undone.</p>
      <div className="my-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">{cart.map(({ product, quantity: itemQuantity }) => <div className="flex justify-between gap-3" key={product._id}><span>{product.name} · {itemQuantity} {product.unit}</span><strong>{money(product.price * itemQuantity)}</strong></div>)}<div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold"><span>Total</span><span>{money(total)}</span></div></div>
      <p className="text-sm text-slate-600">Customer: <strong>{customers.find((customer) => customer._id === customerId)?.name || "Walk-in"}</strong></p>
      <div className="mt-5 flex justify-end gap-2"><button onClick={() => setConfirmOpen(false)} disabled={busy} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Go back</button><button onClick={() => void createSale()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Confirm sale</button></div>
    </Modal>}
    {selectedSale && <Modal title={`Sale #${selectedSale._id.slice(-6).toUpperCase()}`} onClose={() => setSelectedSale(null)}>
      <p className="mb-4 text-xs text-slate-500">{dateTime(selectedSale.createdAt)}</p><div className="space-y-3">{selectedSale.items?.map((item) => <div key={item.productId} className="flex justify-between gap-3 text-sm"><span>{products.find((product) => product._id === item.productId)?.name ?? `Product ${item.productId.slice(-6)}`} · {item.quantity} units × {money(item.unitPrice)}</span><strong>{money(item.quantity * item.unitPrice)}</strong></div>)}</div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold"><span>Total</span><span>{money(selectedSale.totalAmount)}</span></div><div className="mt-2 flex justify-between text-sm text-slate-600"><span>Paid</span><span>{money(selectedSale.amountPaid)}</span></div><div className="mt-2 flex justify-between text-sm text-slate-600"><span>Payment status</span><span>{selectedSale.paymentStatus || "Recorded"}</span></div>
    </Modal>}
  </>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !event.currentTarget.querySelector("button[disabled]")) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">×</button></div>{children}</div></div>;
}
