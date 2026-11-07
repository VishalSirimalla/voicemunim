
import { Bell, Search } from 'lucide-react'

export default function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 bg-white px-8 py-5">
      <div>
        <h2 className="text-xl font-bold text-gray-800">
          Welcome back, Ramesh Bhai!
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening in your shop today.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 sm:flex">
          <Search size={18} className="text-gray-400" />
          <input
            placeholder="Search anything..."
            className="w-40 bg-transparent text-sm outline-none"
          />
        </div>

        <button className="rounded-xl border border-gray-100 p-3 text-gray-600 hover:bg-gray-50">
          <Bell size={20} />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-bold text-green-800">
          R
        </div>
      </div>
    </header>
  )
}
