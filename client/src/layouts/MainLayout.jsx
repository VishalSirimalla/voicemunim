
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Header from '../components/common/Header'

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Sidebar />

      <main className="min-w-0 flex-1">
        <Header />
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
