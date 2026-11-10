import { useCallback, useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card, EmptyState, ErrorNotice, Loading, PageHeading } from "../components/common";
import { createIdempotencyKey, request } from "../services/api";
import type { Product } from "../types/api";
import { money } from "../utils/format";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      if (category) query.set("category", category);
      const data = await request<{ products: Product[] }>(`/products?${query}`);
      setProducts(data.products);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | number> = {
      name: String(form.get("name")).trim(),
      price: Number(form.get("price")),
      unit: String(form.get("unit")).trim(),
      category: String(form.get("category") ?? "").trim(),
    };
    if (!editing) {
      payload.stock = Number(form.get("stock") || 0);
      payload.lowStockThreshold = Number(form.get("lowStockThreshold") || 0);
    } else {
      payload.lowStockThreshold = Number(form.get("lowStockThreshold") || 0);
    }
    try {
      await request(editing ? `/products/${editing._id}` : "/products", {
        method: editing ? "PUT" : "POST",
        body: payload,
      });
      setFormOpen(false);
      setEditing(null);
      setNotice(editing ? "Product details updated." : "Product added to inventory.");
      await loadProducts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save product.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone. Products with transaction history cannot be deleted.`)) return;
    setError("");
    try {
      await request(`/products/${product._id}`, { method: "DELETE" });
      setNotice(`${product.name} deleted.`);
      await loadProducts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete product.");
    }
  };

  const adjustStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stockProduct) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const operation = form.get("operation");
    const quantity = Number(form.get("quantity"));
    const body =
      operation === "STOCK_IN"
        ? { type: operation, quantity }
        : operation === "ADD" || operation === "REMOVE"
          ? { type: "STOCK_ADJUSTMENT", quantity, direction: operation }
          : null;
    if (!body) {
      setBusy(false);
      setError("Choose a valid stock operation.");
      return;
    }
    try {
      await request(`/products/${stockProduct._id}/stock`, {
        method: "POST",
        body,
        idempotencyKey: createIdempotencyKey(),
      });
      setNotice(`${stockProduct.name} stock updated.`);
      setStockProduct(null);
      await loadProducts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update stock.");
    } finally {
      setBusy(false);
    }
  };

  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();

  return <>
    <PageHeading eyebrow="Inventory" title="Products & stock" description="Keep product details and stock levels up to date." action={<button onClick={() => { setEditing(null); setFormOpen(true); setNotice(""); }} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"><Plus className="h-4 w-4" /> Add product</button>} />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products…" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" /></label>
        <label className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-400" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="min-w-36 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-700"><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      {loading ? <Loading label="Loading products…" /> : products.length === 0 ? <div className="p-5"><EmptyState title={search || category ? "No matching products" : "Your inventory is empty"} detail={search || category ? "Try changing the search or category filter." : "Add your first product to keep its price and stock in one place."} action={!search && !category && <button onClick={() => setFormOpen(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Add product</button>} /></div> :
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5 font-semibold">Product</th><th className="px-4 py-3.5 font-semibold">Category</th><th className="px-4 py-3.5 font-semibold">Price</th><th className="px-4 py-3.5 font-semibold">In stock</th><th className="px-4 py-3.5 font-semibold">Threshold</th><th className="px-5 py-3.5 text-right font-semibold">Actions</th></tr></thead>
          <tbody>{products.map((product) => {
            const low = product.stock <= product.lowStockThreshold;
            return <tr key={product._id} className="border-t border-slate-100 hover:bg-slate-50/70">
              <td className="px-5 py-4"><p className="font-semibold text-slate-800">{product.name}</p><p className="mt-0.5 text-xs text-slate-500">{product.unit}</p></td>
              <td className="px-4 py-4 text-slate-500">{product.category || "—"}</td>
              <td className="px-4 py-4 font-medium">{money(product.price)}<span className="ml-1 text-xs font-normal text-slate-500">/ {product.unit}</span></td>
              <td className="px-4 py-4"><span className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${low ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{product.stock} {product.unit}</span></td>
              <td className="px-4 py-4 text-slate-500">{product.lowStockThreshold} {product.unit}</td>
              <td className="px-5 py-4"><div className="flex justify-end gap-1">
                <button title="Adjust stock" onClick={() => { setStockProduct(product); setNotice(""); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">Stock</button>
                <button title="Edit product" onClick={() => { setEditing(product); setFormOpen(true); setNotice(""); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil className="h-4 w-4" /></button>
                <button title="Delete product" onClick={() => void deleteProduct(product)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>}
    </Card>

    {formOpen && <Modal title={editing ? "Edit product" : "Add product"} onClose={() => { setFormOpen(false); setEditing(null); }}>
      <form onSubmit={saveProduct} className="space-y-4">
        <Input label="Product name" name="name" defaultValue={editing?.name} required maxLength={120} />
        <div className="grid gap-4 sm:grid-cols-2"><Input label="Price (₹)" name="price" type="number" defaultValue={editing?.price ?? ""} min="0" step="0.01" required /><Input label="Unit" name="unit" defaultValue={editing?.unit ?? "kg"} required maxLength={32} placeholder="kg, packet, piece…" /></div>
        <Input label="Category (optional)" name="category" defaultValue={editing?.category} maxLength={80} />
        {editing ? <Input label="Low stock threshold" name="lowStockThreshold" type="number" defaultValue={editing.lowStockThreshold} min="0" step="0.001" /> :
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Opening stock" name="stock" type="number" defaultValue="0" min="0" step="0.001" /><Input label="Low stock threshold" name="lowStockThreshold" type="number" defaultValue="0" min="0" step="0.001" /></div>}
        <p className="text-xs leading-5 text-slate-500">Stock changes after creation are recorded through the stock adjustment endpoint.</p>
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium">Cancel</button><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{editing ? "Save changes" : "Add product"}</button></div>
      </form>
    </Modal>}
    {stockProduct && <Modal title={`Adjust ${stockProduct.name} stock`} onClose={() => setStockProduct(null)}>
      <form onSubmit={adjustStock} className="space-y-4">
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">Current stock: <strong className="text-slate-900">{stockProduct.stock} {stockProduct.unit}</strong></p>
        <label className="block text-sm font-medium text-slate-700">Stock operation<select name="operation" defaultValue="STOCK_IN" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"><option value="STOCK_IN">Stock In · received from supplier</option><option value="ADD">Stock adjustment · add</option><option value="REMOVE">Stock removal · decrease stock</option></select></label>
        <Input label="Quantity" name="quantity" type="number" min="0.001" max="100000" step="0.001" required />
        <p className="text-xs text-slate-500">Stock removal is recorded as a stock adjustment with direction REMOVE.</p>
        <p className="text-xs text-slate-500">Stock is limited to 100,000 units with up to 3 decimal places.</p>
        <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setStockProduct(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm">Cancel</button><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Save stock</button></div>
      </form>
    </Modal>}
  </>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">×</button></div>{children}</div></div>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" {...props} /></label>;
}
