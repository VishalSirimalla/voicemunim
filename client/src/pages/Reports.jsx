
import { useMemo, useState } from 'react'
import {
  TrendingUp, Banknote, Wallet, ShoppingBag,
  CalendarDays, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis,
  YAxis, CartesianGrid, Tooltip, PieChart,
  Pie, Cell
} from 'recharts'

const dailyData = [
  { day: 'Mon', sales: 5200, cash: 3900, udhar: 1300 },
  { day: 'Tue', sales: 6800, cash: 5100, udhar: 1700 },
  { day: 'Wed', sales: 4500, cash: 3500, udhar: 1000 },
  { day: 'Thu', sales: 7900, cash: 5900, udhar: 2000 },
  { day: 'Fri', sales: 6200, cash: 4800, udhar: 1400 },
  { day: 'Sat', sales: 8750, cash: 6750, udhar: 2000 },
  { day: 'Sun', sales: 7100, cash: 5600, udhar: 1500 },
]

const topProducts = [
  { name: 'Tata Salt', sold: 85, revenue: 2125 },
  { name: 'Parle-G Biscuits', sold: 120, revenue: 1200 },
  { name: 'Amul Butter', sold: 32, revenue: 1856 },
  { name: 'Maggi Noodles', sold: 95, revenue: 1330 },
  { name: 'Sugar (1 kg)', sold: 68, revenue: 3060 },
]

const recentTransactions = [
  { id: 1, customer: 'Rahul Sharma', amount: 450, method: 'Cash', date: '08 Nov 2026' },
  { id: 2, customer: 'Amit Kumar', amount: 850, method: 'Udhar', date: '08 Nov 2026' },
  { id: 3, customer: 'Priya Patel', amount: 650, method: 'Cash', date: '07 Nov 2026' },
  { id: 4, customer: 'Sneha Reddy', amount: 1200, method: 'Udhar', date: '07 Nov 2026' },
]

const COLORS = ['#15803d', '#f59e0b']

export default function Reports() {
  const [range, setRange] = useState('7 Days')

  const visibleData = useMemo(() => {
    if (range === 'Today') return dailyData.slice(-1)
    if (range === '30 Days') return dailyData
    return dailyData.slice(-7)
  }, [range])

  const totalSales = visibleData.reduce((sum, item) => sum + item.sales, 0)
  const cashSales = visibleData.reduce((sum, item) => sum + item.cash, 0)
  const udharSales = visibleData.reduce((sum, item) => sum + item.udhar, 0)

  const paymentData = [
    { name: 'Cash', value: cashSales },
    { name: 'Udhar', value: udharSales },
  ]

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Understand your shop's sales and business performance.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <CalendarDays size={17} className="text-gray-500" />
          <select
            value={range}
            onChange={event => setRange(event.target.value)}
            className="bg-transparent text-sm font-medium text-gray-700 outline-none"
          >
            <option>Today</option>
            <option>7 Days</option>
            <option>30 Days</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Sales"
          value={totalSales}
          icon={TrendingUp}
          color="bg-green-100 text-green-700"
          trend="+12.5%"
        />

        <SummaryCard
          title="Cash Sales"
          value={cashSales}
          icon={Banknote}
          color="bg-blue-100 text-blue-700"
          trend="Collected"
        />

        <SummaryCard
          title="Udhar Sales"
          value={udharSales}
          icon={Wallet}
          color="bg-orange-100 text-orange-700"
          trend="Credit"
        />

        <SummaryCard
          title="Products Sold"
          value={topProducts.reduce((sum, p) => sum + p.sold, 0)}
          icon={ShoppingBag}
          color="bg-purple-100 text-purple-700"
          isCount
          trend="Units"
        />
      </div>

      {/* Sales chart */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-800">
              Sales Overview
            </h2>
            <p className="text-sm text-gray-500">
              Daily revenue during the selected period.
            </p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visibleData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={value => `₹${value / 1000}k`}
                />
                <Tooltip
                  formatter={value => [
                    `₹${Number(value).toLocaleString('en-IN')}`,
                    'Sales',
                  ]}
                />
                <Bar
                  dataKey="sales"
                  fill="#15803d"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Payment distribution */}
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800">
            Payment Breakdown
          </h2>
          <p className="text-sm text-gray-500">
            Cash vs Udhar sales.
          </p>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={value =>
                    `₹${Number(value).toLocaleString('en-IN')}`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {paymentData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[index] }}
                  />
                  {item.name}
                </div>
                <span className="font-semibold text-gray-800">
                  ₹{item.value.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Best selling products */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-800">
            Best-Selling Products
          </h2>
          <p className="text-sm text-gray-500">
            Products generating the most sales.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Units Sold</th>
                <th className="px-5 py-3 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map(product => (
                <tr key={product.name} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {product.name}
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {product.sold}
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    ₹{product.revenue.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent transactions */}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="p-5">
          <h2 className="text-lg font-bold text-gray-800">
            Recent Transactions
          </h2>
          <p className="text-sm text-gray-500">
            Latest customer sales.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[550px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map(transaction => (
                <tr key={transaction.id} className="border-t border-gray-100">
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    {transaction.customer}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {transaction.date}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      transaction.method === 'Cash'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {transaction.method}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-gray-800">
                    ₹{transaction.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color, trend, isCount }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
          <ArrowUpRight size={14} />
          {trend}
        </span>
      </div>

      <p className="mt-4 text-sm text-gray-500">{title}</p>
      <h3 className="mt-1 text-2xl font-bold text-gray-800">
        {isCount ? value : `₹${value.toLocaleString('en-IN')}`}
      </h3>
    </div>
  )
}
