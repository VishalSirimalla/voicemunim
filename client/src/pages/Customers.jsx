
import { useMemo, useState } from 'react'
import {
  Search, Plus, Users, Wallet, UserCheck,
  Pencil, Trash2, X, Phone
} from 'lucide-react'

const initialCustomers = [
  { id: 1, name: 'Rahul Sharma', phone: '9876543210', balance: 450 },
  { id: 2, name: 'Priya Patel', phone: '9876543211', balance: 0 },
  { id: 3, name: 'Amit Kumar', phone: '9876543212', balance: 850 },
  { id: 4, name: 'Sneha Reddy', phone: '9876543213', balance: 1200 },
  { id: 5, name: 'Ramesh Gupta', phone: '9876543214', balance: 0 },
]

const emptyForm = { name: '', phone: '' }

export default function Customers() {
  const [customers, setCustomers] = useState(initialCustomers)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(search.toLowerCase()) ||
      customer.phone.includes(search)
    )
  }, [customers, search])

  const outstanding = customers.reduce(
    (total, customer) => total + customer.balance, 0
  )

  const openAddForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEditForm = customer => {
    setEditingId(customer.id)
    setForm({ name: customer.name, phone: customer.phone })
    setShowForm(true)
  }

  const handleSubmit = event => {
    event.preventDefault()

    const updatedCustomer = {
      id: editingId ?? Date.now(),
      name: form.name.trim(),
      phone: form.phone.trim(),
      balance: editingId === null
        ? 0
        : customers.find(c => c.id === editingId).balance,
    }

    if (editingId !== null) {
      setCustomers(current =>
        current.map(c => c.id === editingId ? updatedCustomer : c)
      )
    } else {
      setCustomers(current => [updatedCustomer, ...current])
    }

    setShowForm(false)
    setForm(emptyForm)
    setEditingId(null)
  }

  const deleteCustomer = id => {
    const customer = customers.find(c => c.id === id)

    if (customer.balance > 0) {
      alert('This customer has outstanding credit. Settle the balance before deleting.')
      return
    }

    if (window.confirm('Delete this customer?')) {
      setCustomers(current => current.filter(c => c.id !== id))
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Customer Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage customer information and outstanding credit.
          </p>
        </div>

        <button
          onClick={openAddForm}
          className="flex items-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Total Customers"
          value={customers.length}
          icon={Users}
          color="bg-blue-100 text-blue-700"
        />

        <SummaryCard
          title="Customers with Udhar"
          value={customers.filter(c => c.balance > 0).length}
          icon={UserCheck}
          color="bg-orange-100 text-orange-700"
        />

        <SummaryCard
          title="Total Outstanding"
          value={`₹${outstanding.toLocaleString('en-IN')}`}
          icon={Wallet}
          color="bg-green-100 text-green-700"
        />
      </div>

      {/* Customer table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              All Customers
            </h2>
            <p className="text-sm text-gray-500">
              {filteredCustomers.length} customers found
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full text-sm outline-none sm:w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-4 font-medium">Customer</th>
                <th className="px-5 py-4 font-medium">Phone Number</th>
                <th className="px-5 py-4 font-medium">Outstanding Udhar</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {customer.name}
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    <span className="flex items-center gap-2">
                      <Phone size={15} />
                      {customer.phone}
                    </span>
                  </td>

                  <td className="px-5 py-4 font-semibold text-gray-800">
                    ₹{customer.balance.toLocaleString('en-IN')}
                  </td>

                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      customer.balance > 0
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {customer.balance > 0 ? 'Pending' : 'Clear'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditForm(customer)}
                        title="Edit customer"
                        className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        onClick={() => deleteCustomer(customer.id)}
                        title="Delete customer"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCustomers.length === 0 && (
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

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId !== null ? 'Edit Customer' : 'Add New Customer'}
              </h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Customer Name
                </span>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter customer name"
                  className="form-input"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">
                  Phone Number
                </span>
                <input
                  required
                  type="tel"
                  pattern="[0-9]{10}"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile number"
                  className="form-input"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded-xl bg-green-700 px-5 py-2 text-sm font-semibold text-white"
              >
                {editingId !== null ? 'Save Changes' : 'Add Customer'}
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
