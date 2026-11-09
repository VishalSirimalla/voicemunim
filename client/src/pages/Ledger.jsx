
import { useMemo, useState } from 'react'
import {
  Search, Wallet, Users, Banknote, Plus,
  X, History, IndianRupee, CheckCircle
} from 'lucide-react'

const initialLedger = [
  {
    id: 1,
    name: 'Rahul Sharma',
    phone: '9876543210',
    balance: 450,
    transactions: [
      { id: 1, type: 'Credit', description: 'Groceries', amount: 700, date: '08 Nov 2026' },
      { id: 2, type: 'Payment', description: 'Cash payment', amount: 250, date: '08 Nov 2026' },
    ],
  },
  {
    id: 2,
    name: 'Amit Kumar',
    phone: '9876543212',
    balance: 850,
    transactions: [
      { id: 3, type: 'Credit', description: 'Monthly groceries', amount: 850, date: '07 Nov 2026' },
    ],
  },
  {
    id: 3,
    name: 'Sneha Reddy',
    phone: '9876543213',
    balance: 1200,
    transactions: [
      { id: 4, type: 'Credit', description: 'Household items', amount: 1500, date: '06 Nov 2026' },
      { id: 5, type: 'Payment', description: 'Partial payment', amount: 300, date: '07 Nov 2026' },
    ],
  },
  {
    id: 4,
    name: 'Priya Patel',
    phone: '9876543211',
    balance: 0,
    transactions: [
      { id: 6, type: 'Credit', description: 'Groceries', amount: 500, date: '05 Nov 2026' },
      { id: 7, type: 'Payment', description: 'Full payment', amount: 500, date: '06 Nov 2026' },
    ],
  },
]

export default function Ledger() {
  const [ledger, setLedger] = useState(initialLedger)
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [paymentCustomer, setPaymentCustomer] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('Cash payment')

  const totalOutstanding = ledger.reduce(
    (sum, customer) => sum + customer.balance, 0
  )

  const totalCollected = ledger.reduce(
    (sum, customer) =>
      sum + customer.transactions
        .filter(t => t.type === 'Payment')
        .reduce((total, t) => total + t.amount, 0),
    0
  )

  const pendingCustomers = ledger.filter(c => c.balance > 0).length

  const filteredLedger = useMemo(() => {
    return ledger.filter(customer =>
      customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.phone.includes(search)
    )
  }, [ledger, search])

  const recordPayment = event => {
    event.preventDefault()

    const amount = Number(paymentAmount)

    if (!paymentCustomer || !Number.isFinite(amount) || amount <= 0) {
      alert('Please enter a valid payment amount.')
      return
    }

    if (amount > paymentCustomer.balance) {
      alert('Payment cannot be greater than the outstanding balance.')
      return
    }

    setLedger(current =>
      current.map(customer => {
        if (customer.id !== paymentCustomer.id) return customer

        return {
          ...customer,
          balance: customer.balance - amount,
          transactions: [
            {
              id: Date.now(),
              type: 'Payment',
              description: paymentNote.trim() || 'Customer payment',
              amount,
              date: new Date().toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }),
            },
            ...customer.transactions,
          ],
        }
      })
    )

    setPaymentCustomer(null)
    setPaymentAmount('')
    setPaymentNote('Cash payment')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Udhar Ledger
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track customer credit, outstanding balances and payments.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Total Outstanding"
          value={totalOutstanding}
          icon={Wallet}
          color="bg-orange-100 text-orange-700"
        />

        <SummaryCard
          title="Total Payments Collected"
          value={totalCollected}
          icon={Banknote}
          color="bg-green-100 text-green-700"
        />

        <SummaryCard
          title="Customers with Pending Udhar"
          value={pendingCustomers}
          icon={Users}
          color="bg-blue-100 text-blue-700"
          isCount
        />
      </div>

      {/* Customer ledger table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Customer Balances
            </h2>
            <p className="text-sm text-gray-500">
              View and manage customer outstanding amounts.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search customer..."
              className="w-full text-sm outline-none sm:w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-4 font-medium">Customer</th>
                <th className="px-5 py-4 font-medium">Phone</th>
                <th className="px-5 py-4 font-medium">Outstanding</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredLedger.map(customer => (
                <tr key={customer.id} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {customer.name}
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {customer.phone}
                  </td>

                  <td className="px-5 py-4 font-bold text-gray-800">
                    ₹{customer.balance.toLocaleString('en-IN')}
                  </td>

                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      customer.balance > 0
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {customer.balance > 0 ? 'Pending' : 'Clear'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <History size={14} className="mr-1 inline" />
                        History
                      </button>

                      {customer.balance > 0 && (
                        <button
                          onClick={() => setPaymentCustomer(customer)}
                          className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                        >
                          <Plus size={14} className="mr-1 inline" />
                          Payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLedger.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-5 py-10 text-center text-gray-500">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer transaction history */}
      {selectedCustomer && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {selectedCustomer.name}'s Transaction History
              </h2>
              <p className="text-sm text-gray-500">
                {selectedCustomer.phone}
              </p>
            </div>

            <button
              onClick={() => setSelectedCustomer(null)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {ledger.find(c => c.id === selectedCustomer.id)?.transactions.map(transaction => (
              <div
                key={transaction.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {transaction.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {transaction.date}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${
                    transaction.type === 'Credit'
                      ? 'text-red-600'
                      : 'text-green-700'
                  }`}>
                    {transaction.type === 'Credit' ? '+' : '-'}
                    ₹{transaction.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {transaction.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {paymentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={recordPayment}
            className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Record Payment
              </h2>
              <button
                type="button"
                onClick={() => setPaymentCustomer(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-sm text-gray-600">Customer</p>
              <p className="mt-1 font-bold text-gray-800">
                {paymentCustomer.name}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Outstanding: <strong className="text-green-700">
                  ₹{paymentCustomer.balance.toLocaleString('en-IN')}
                </strong>
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Payment Amount (₹)
              </span>
              <input
                required
                type="number"
                min="0.01"
                max={paymentCustomer.balance}
                step="0.01"
                value={paymentAmount}
                onChange={event => setPaymentAmount(event.target.value)}
                placeholder="Enter amount"
                className="form-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Payment Note
              </span>
              <input
                value={paymentNote}
                onChange={event => setPaymentNote(event.target.value)}
                placeholder="e.g. Cash payment"
                className="form-input"
              />
            </label>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800"
            >
              <CheckCircle size={18} />
              Save Payment
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color, isCount }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className={`rounded-xl p-3 ${color}`}>
        <Icon size={23} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <h3 className="mt-1 text-2xl font-bold text-gray-800">
          {isCount ? value : `₹${value.toLocaleString('en-IN')}`}
        </h3>
      </div>
    </div>
  )
}
