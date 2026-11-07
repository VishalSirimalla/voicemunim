
import { useMemo, useState } from 'react'
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  Receipt, Wallet, Banknote, UserRound, CheckCircle
} from 'lucide-react'

const products = [
  { id: 1, name: 'Tata Salt', price: 25, stock: 50 },
  { id: 2, name: 'Parle-G Biscuits', price: 10, stock: 100 },
  { id: 3, name: 'Amul Butter', price: 58, stock: 20 },
  { id: 4, name: 'Maggi Noodles', price: 14, stock: 60 },
  { id: 5, name: 'Sugar (1 kg)', price: 45, stock: 35 },
  { id: 6, name: 'Rice (1 kg)', price: 65, stock: 40 },
  { id: 7, name: 'Cooking Oil (1 L)', price: 140, stock: 25 },
  { id: 8, name: 'Milk (500 ml)', price: 30, stock: 45 },
]

const customers = [
  { id: 1, name: 'Rahul Sharma', phone: '9876543210' },
  { id: 2, name: 'Priya Patel', phone: '9876543211' },
  { id: 3, name: 'Amit Kumar', phone: '9876543212' },
  { id: 4, name: 'Sneha Reddy', phone: '9876543213' },
]

export default function Sales() {
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [completedSale, setCompletedSale] = useState(null)

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  )

  const subtotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart]
  )

  const addToCart = product => {
    if (product.stock < 1) return

    setCart(current => {
      const existing = current.find(item => item.id === product.id)

      if (existing) {
        if (existing.quantity >= product.stock) return current
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...current, { ...product, quantity: 1 }]
    })
  }

  const updateQuantity = (id, amount) => {
    setCart(current =>
      current
        .map(item =>
          item.id === id
            ? { ...item, quantity: Math.min(item.stock, item.quantity + amount) }
            : item
        )
        .filter(item => item.quantity > 0)
    )
  }

  const removeItem = id => {
    setCart(current => current.filter(item => item.id !== id))
  }

  const selectedCustomer = customers.find(
    customer => customer.id === Number(customerId)
  )

  const completeSale = () => {
    if (cart.length === 0) {
      alert('Please add at least one product.')
      return
    }

    if (paymentMethod === 'Udhar' && !selectedCustomer) {
      alert('Please select a customer for an Udhar transaction.')
      return
    }

    const sale = {
      id: Date.now(),
      items: cart,
      total: subtotal,
      paymentMethod,
      customer: selectedCustomer?.name || 'Walk-in Customer',
      date: new Date().toLocaleString('en-IN'),
    }

    setCompletedSale(sale)
    setCart([])
    setCustomerId('')
    setPaymentMethod('Cash')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Sales & Billing</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create bills and record customer payments.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Product selection */}
        <section className="space-y-4 xl:col-span-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-800">
              Select Products
            </h2>

            <div className="mb-5 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-3">
              <Search size={18} className="text-gray-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full text-sm outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock === 0}
                  className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
                >
                  <p className="font-semibold text-gray-800">{product.name}</p>
                  <p className="mt-2 text-lg font-bold text-green-700">
                    ₹{product.price}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Stock: {product.stock}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                    <Plus size={14} /> Add to bill
                  </span>
                </button>
              ))}

              {filteredProducts.length === 0 && (
                <p className="col-span-full py-8 text-center text-gray-500">
                  No products found.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Cart and billing */}
        <section className="h-fit rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Current Bill</h2>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {cart.length} items
            </span>
          </div>

          <div className="max-h-72 space-y-4 overflow-y-auto">
            {cart.map(item => (
              <div key={item.id} className="border-b border-gray-100 pb-4">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold text-gray-800">{item.name}</p>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-500"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-gray-500">₹{item.price} each</p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="rounded-lg bg-gray-100 p-1"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={item.quantity >= item.stock}
                      className="rounded-lg bg-gray-100 p-1 disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-right font-bold text-gray-800">
                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                </p>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="py-10 text-center">
                <ShoppingCart size={35} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">
                  Your bill is empty.
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Select products to get started.
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Total</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <UserRound size={16} /> Select Customer
              </span>
              <select
                value={customerId}
                onChange={event => setCustomerId(event.target.value)}
                className="form-input"
              >
                <option value="">Walk-in Customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-gray-700">
                Payment Method
              </p>
              <div className="grid grid-cols-2 gap-3">
                {['Cash', 'Udhar'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
                      paymentMethod === method
                        ? 'border-green-600 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {method === 'Cash'
                      ? <Banknote size={17} />
                      : <Wallet size={17} />}
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={completeSale}
              disabled={cart.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Receipt size={18} /> Complete Sale
            </button>
          </div>
        </section>
      </div>

      {/* Confirmation dialog */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <CheckCircle size={48} className="mx-auto text-green-600" />
              <h2 className="mt-3 text-xl font-bold text-gray-800">
                Bill Created!
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Sale #{completedSale.id}
              </p>
            </div>

            <div className="my-5 space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <p>Customer: <strong>{completedSale.customer}</strong></p>
              <p>Payment: <strong>{completedSale.paymentMethod}</strong></p>
              <p>Items: <strong>{completedSale.items.length}</strong></p>
              <p className="text-lg font-bold text-green-700">
                Total: ₹{completedSale.total.toLocaleString('en-IN')}
              </p>
            </div>

            <button
              onClick={() => setCompletedSale(null)}
              className="w-full rounded-xl bg-green-700 py-3 font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
