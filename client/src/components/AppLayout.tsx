import { useState } from "react";
import {
  AudioLines,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleUserRound,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  ShoppingBasket,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navigation = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/customers", label: "Customers", icon: UsersRound },
  { to: "/sales", label: "Sales & billing", icon: ShoppingBasket },
  { to: "/ledger", label: "Udhar ledger", icon: WalletCards },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/voice", label: "Voice assistant", icon: AudioLines },
];

export function AppLayout() {
  const { shop, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const active = navigation.find((item) => item.to === location.pathname);

  const logout = async () => {
    setError("");
    try {
      await signOut();
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not log out.");
    }
  };

  const sideNav = (
    <>
      <div className="flex h-[76px] items-center gap-3 px-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white">
          <Command className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold tracking-tight text-slate-950">VoiceMunim</p>
          <p className="text-[11px] text-slate-500">Your shop, in control</p>
        </div>
        <button className="ml-auto rounded-lg p-2 text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-4 mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current shop</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">{shop?.shopName}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Workspace</p>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                isActive
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
            {label === "Voice assistant" && <span className="ml-auto rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800">AI</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100"}`}>
          <Settings className="h-[18px] w-[18px]" /> Settings
        </NavLink>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700">
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200 bg-white lg:flex">
        {sideNav}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/30" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
          <aside className="relative flex h-full w-[280px] flex-col bg-white shadow-xl">{sideNav}</aside>
        </div>
      )}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="h-5 w-5" />
            </button>
            <PanelLeftClose className="hidden h-4 w-4 text-slate-400 lg:block" />
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{active?.label ?? "Shop settings"}</p>
              <p className="text-[11px] text-slate-500">Business workspace</p>
            </div>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{shop?.ownerName?.slice(0, 1).toUpperCase()}</span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-36 truncate text-xs font-semibold">{shop?.ownerName}</span>
                <span className="block max-w-36 truncate text-[10px] text-slate-500">{shop?.shopName}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {menuOpen && <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><CircleUserRound className="h-4 w-4" /> Shop settings</button>
              <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"><LogOut className="h-4 w-4" /> Sign out</button>
            </div>}
          </div>
        </header>
        {error && <div className="mx-4 mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 sm:mx-7">{error}</div>}
        <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
