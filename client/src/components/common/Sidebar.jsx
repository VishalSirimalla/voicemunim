import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  BookOpen,
  ChartNoAxesCombined,
  Mic,
  Store,
} from 'lucide-react'

const menuItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { name: 'Inventory', icon: Package, path: '/inventory' },
  { name: 'Customers', icon: Users, path: '/customers' },
  { name: 'Sales & Billing', icon: ShoppingCart, path: '/sales' },
  { name: 'Udhar Ledger', icon: BookOpen, path: '/ledger' },
  { name: 'Reports', icon: ChartNoAxesCombined, path: '/reports' },
  { name: 'Voice Assistant', icon: Mic, path: '/voice' },
]

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-green-950 px-5 py-6 text-white">
      <div className="mb-10 flex items-center gap-3">
        <div className="rounded-xl bg-white p-2 text-green-800">
          <Store size={25} />
        </div>
        <div>
          <h1 className="text-xl font-bold">VoiceMunim</h1>
          <p className="text-xs text-green-200">Your Voice Accountant</p>
        </div>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-300">
        Main Menu
      </p>

      <nav className="flex-1 space-y-2">
        {menuItems.map(({ name, icon: Icon, path }) => (
          <NavLink
  key={name}
  to={path}
  end={path === '/'}
  className={({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
      isActive
        ? 'bg-green-700 text-white'
        : 'text-green-100 hover:bg-green-800 hover:text-white'
    }`
  }
>
  <Icon size={19} />
  {name}
</NavLink>
        ))}
      </nav>

      <div className="rounded-2xl bg-green-800 p-4">
        <Mic size={24} className="mb-3 text-green-200" />
        <p className="font-semibold">Voice Assistant</p>
        <p className="mt-1 text-xs text-green-200">
          Manage your shop using your voice.
        </p>
      </div>
    </aside>
  )
}
