
import {
  IndianRupee,
  Package,
  AlertTriangle,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Mic,
  ShoppingBag,
} from 'lucide-react'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

const stats = [
  {
    title: "Today's Sales",
    value: '₹8,750',
    change: '+12.5%',
    positive: true,
    icon: IndianRupee,
    color: 'bg-green-100 text-green-700',
  },
  {
    title: 'Total Products',
    value: '245',
    change: '+8 new',
    positive: true,
    icon: Package,
    color: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'Low Stock Items',
    value: '5',
    change: 'Needs attention',
    positive: false,
    icon: AlertTriangle,
    color: 'bg-orange-100 text-orange-700',
  },
  {
    title: 'Outstanding Credit',
    value: '₹3,250',
    change: 'From 12 customers',
    positive: false,
    icon: Users,
    color: 'bg-purple-100 text-purple-700',
  },
]

const salesData = [
  { day: 'Mon', sales: 4200 },
  { day: 'Tue', sales: 5800 },
  { day: 'Wed', sales: 3900 },
  { day: 'Thu', sales: 7200 },
  { day: 'Fri', sales: 6100 },
  { day: 'Sat', sales: 8750 },
  { day: 'Sun', sales: 6800 },
]

const lowStockItems = [
  { name: 'Tata Salt', quantity: '3 packets', status: 'Critical' },
  { name: 'Parle-G', quantity: '5 packets', status: 'Low' },
  { name: 'Amul Butter', quantity: '2 packs', status: 'Critical' },
  { name: 'Maggi Noodles', quantity: '4 packets', status: 'Low' },
]

const transactions = [
  {
    customer: 'Rahul Sharma',
    items: 'Milk, Bread, Eggs',
    amount: '₹250',
    type: 'Cash',
    time: '10:30 AM',
  },
  {
    customer: 'Priya Patel',
    items: 'Rice, Sugar',
    amount: '₹540',
    type: 'Credit',
    time: '11:15 AM',
  },
  {
    customer: 'Amit Kumar',
    items: 'Oil, Biscuits',
    amount: '₹180',
    type: 'Cash',
    time: '12:05 PM',
  },
  {
    customer: 'Sneha Verma',
    items: 'Tea, Soap',
    amount: '₹320',
    type: 'Credit',
    time: '01:20 PM',
  },
]

function StatCard({ item }) {
  const Icon = item.icon

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-3 ${item.color}`}>
          <Icon size={22} />
        </div>

        {item.positive ? (
          <ArrowUpRight size={19} className="text-green-600" />
        ) : (
          <ArrowDownRight size={19} className="text-orange-500" />
        )}
      </div>

      <p className="mt-5 text-sm text-gray-500">{item.title}</p>

      <h3 className="mt-1 text-2xl font-bold text-gray-800">
        {item.value}
      </h3>

      <p className="mt-2 text-xs text-gray-500">{item.change}</p>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="space-y-7">

      {/* Dashboard heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's your shop's performance at a glance.
          </p>
        </div>

        <span className="rounded-lg bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          Today
        </span>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.title} item={item} />
        ))}
      </div>

      {/* Sales chart and stock alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800">
              Sales Overview
            </h2>
            <p className="text-sm text-gray-500">
              Your sales performance this week
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} />

                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `₹${value / 1000}k`}
                />

                <Tooltip formatter={(value) => [`₹${value}`, 'Sales']} />

                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#16a34a"
                  strokeWidth={3}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low stock */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Low Stock Alerts
              </h2>
              <p className="text-sm text-gray-500">
                Products running low
              </p>
            </div>

            <AlertTriangle className="text-orange-500" size={22} />
          </div>

          <div className="space-y-4">
            {lowStockItems.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} left
                  </p>
                </div>

                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                  item.status === 'Critical'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          <button className="mt-3 w-full rounded-xl bg-green-50 py-3 text-sm font-semibold text-green-700 hover:bg-green-100">
            View Inventory
          </button>
        </div>
      </div>

      {/* Voice Assistant */}
      <div className="flex flex-col items-center justify-between gap-5 rounded-2xl bg-green-900 p-6 text-white sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <Mic size={22} />
            <h2 className="text-lg font-bold">Voice Assistant</h2>
          </div>

          <p className="mt-2 text-sm text-green-100">
            Manage your shop easily using your voice.
          </p>

          <p className="mt-3 text-sm text-green-200">
            Try: "Aaj ki total sale kitni hui?"
          </p>
        </div>

        <button
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-green-800 shadow-lg transition hover:scale-105"
          aria-label="Start voice assistant"
        >
          <Mic size={30} />
        </button>
      </div>

      {/* Recent transactions */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between p-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Recent Transactions
            </h2>
            <p className="text-sm text-gray-500">
              Latest shop transactions
            </p>
          </div>

          <ShoppingBag className="text-green-700" size={22} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.customer} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {transaction.customer}
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {transaction.items}
                  </td>

                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {transaction.amount}
                  </td>

                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      transaction.type === 'Cash'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {transaction.type}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {transaction.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
