
import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  IndianRupee,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

const initialProducts = [
  { id: 1, name: 'Tata Salt', category: 'Grocery', price: 25, stock: 3, unit: 'packets' },
  { id: 2, name: 'Parle-G', category: 'Snacks', price: 10, stock: 5, unit: 'packets' },
  { id: 3, name: 'Amul Butter', category: 'Dairy', price: 58, stock: 2, unit: 'packs' },
  { id: 4, name: 'Maggi Noodles', category: 'Snacks', price: 14, stock: 4, unit: 'packets' },
  { id: 5, name: 'Fortune Oil', category: 'Grocery', price: 150, stock: 30, unit: 'bottles' },
  { id: 6, name: 'Amul Milk', category: 'Dairy', price: 28, stock: 45, unit: 'packets' },
  { id: 7, name: 'Colgate Toothpaste', category: 'Personal Care', price: 55, stock: 18, unit: 'pieces' },
]

const emptyForm = {
  name: '',
  category: 'Grocery',
  price: '',
  stock: '',
  unit: 'pieces',
}

export default function Inventory() {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesCategory =
        category === 'All' || product.category === category

      return matchesSearch && matchesCategory
    })
  }, [products, search, category])

  const lowStockCount = products.filter((product) => product.stock <= 5).length

  const openAddForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEditForm = (product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      unit: product.unit,
    })
    setShowForm(true)
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    const updatedProduct = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      unit: form.unit.trim(),
    }

    if (editingId !== null) {
      setProducts((current) =>
        current.map((product) =>
          product.id === editingId ? updatedProduct : product
        )
      )
    } else {
      setProducts((current) => [updatedProduct, ...current])
    }

    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
  }

  const deleteProduct = (id) => {
    const confirmed = window.confirm('Are you sure you want to delete this product?')

    if (confirmed) {
      setProducts((current) =>
        current.filter((product) => product.id !== id)
      )
    }
  }

  return (
    <div className="space-y-7">

      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Inventory Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your shop products, prices and stock levels.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SummaryCard
          title="Total Products"
          value={products.length}
          icon={Package}
          color="bg-blue-100 text-blue-700"
        />

        <SummaryCard
          title="Low Stock Products"
          value={lowStockCount}
          icon={AlertTriangle}
          color="bg-orange-100 text-orange-700"
        />

        <SummaryCard
          title="Inventory Value"
          value={`₹${products.reduce(
            (total, product) => total + product.price * product.stock,
            0
          ).toLocaleString('en-IN')}`}
          icon={IndianRupee}
          color="bg-green-100 text-green-700"
        />
      </div>

      {/* Product table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              All Products
            </h2>
            <p className="text-sm text-gray-500">
              {filteredProducts.length} products found
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <Search size={18} className="text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full text-sm outline-none sm:w-44"
              />
            </div>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
            >
              <option>All</option>
              <option>Grocery</option>
              <option>Snacks</option>
              <option>Dairy</option>
              <option>Personal Care</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-4 font-medium">Product</th>
                <th className="px-5 py-4 font-medium">Category</th>
                <th className="px-5 py-4 font-medium">Price</th>
                <th className="px-5 py-4 font-medium">Stock</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {product.name}
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {product.category}
                  </td>

                  <td className="px-5 py-4 font-medium text-gray-800">
                    ₹{product.price}
                  </td>

                  <td className="px-5 py-4 text-gray-600">
                    {product.stock} {product.unit}
                  </td>

                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      product.stock <= 3
                        ? 'bg-red-100 text-red-700'
                        : product.stock <= 5
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {product.stock <= 3
                        ? 'Critical'
                        : product.stock <= 5
                          ? 'Low Stock'
                          : 'In Stock'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(product)}
                        title="Edit product"
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => deleteProduct(product.id)}
                        title="Delete product"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center text-gray-500">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit product form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId !== null ? 'Edit Product' : 'Add New Product'}
              </h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Product Name">
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. Tata Salt"
                  className="form-input"
                />
              </FormField>

              <FormField label="Category">
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  className="form-input"
                >
                  <option>Grocery</option>
                  <option>Snacks</option>
                  <option>Dairy</option>
                  <option>Personal Care</option>
                </select>
              </FormField>

              <FormField label="Price (₹)">
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  placeholder="Product price"
                  className="form-input"
                />
              </FormField>

              <FormField label="Stock Quantity">
                <input
                  required
                  min="0"
                  step="1"
                  type="number"
                  value={form.stock}
                  onChange={(event) =>
                    setForm({ ...form, stock: event.target.value })
                  }
                  placeholder="Available quantity"
                  className="form-input"
                />
              </FormField>

              <FormField label="Unit">
                <input
                  required
                  value={form.unit}
                  onChange={(event) =>
                    setForm({ ...form, unit: event.target.value })
                  }
                  placeholder="packets, kg, pieces..."
                  className="form-input"
                />
              </FormField>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800"
              >
                {editingId !== null ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon size={23} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h3 className="mt-1 text-2xl font-bold text-gray-800">{value}</h3>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  )
}
