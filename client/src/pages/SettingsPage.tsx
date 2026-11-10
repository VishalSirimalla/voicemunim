import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { LoaderCircle, Save, ShieldCheck, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, ErrorNotice, PageHeading } from "../components/common";
import { useAuth } from "../hooks/useAuth";
import { request, tokenStore } from "../services/api";
import type { Shop } from "../types/api";

export function SettingsPage() {
  const { shop, updateShop } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries()) as Record<string, string>;
    try {
      const updated = await request<Shop>("/auth/me", { method: "PUT", body });
      updateShop(updated);
      setNotice("Shop details saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update shop details.");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await request("/auth/password", {
        method: "PUT",
        body: { currentPassword: String(form.get("currentPassword")), newPassword: String(form.get("newPassword")) },
      });
      tokenStore.clear();
      updateShop(null);
      navigate("/login", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  };

  return <>
    <PageHeading eyebrow="Settings" title="Shop settings" description="Manage your shop profile and account security." />
    {error && <div className="mb-4"><ErrorNotice message={error} /></div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><Store className="h-4 w-4" /></span><div><h2 className="font-semibold">Business profile</h2><p className="text-xs text-slate-500">These details belong to your authenticated shop.</p></div></div>
        <form onSubmit={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <Input label="Shop name" name="shopName" defaultValue={shop?.shopName} required maxLength={120} />
          <Input label="Owner name" name="ownerName" defaultValue={shop?.ownerName} required maxLength={120} />
          <Input label="Email address" name="email" type="email" defaultValue={shop?.email} required maxLength={254} />
          <Input label="Phone number" name="phone" type="tel" defaultValue={shop?.phone} required maxLength={20} />
          <Input label="Business address" name="businessAddress" defaultValue={shop?.businessAddress} maxLength={500} />
          <Input label="Preferred language" name="preferredLanguage" defaultValue={shop?.preferredLanguage} maxLength={32} />
          <Input label="Business timezone" name="businessTimezone" defaultValue={shop?.businessTimezone} maxLength={64} />
          <div className="flex items-end sm:col-span-2"><button disabled={busy} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save profile</button></div>
        </form>
      </Card>
      <Card className="p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="font-semibold">Change password</h2><p className="text-xs text-slate-500">Use a strong password you haven't used elsewhere.</p></div></div>
        <form onSubmit={changePassword} className="space-y-4">
          <Input label="Current password" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
          <Input label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={10} maxLength={128} />
          <p className="text-xs leading-5 text-slate-500">Changing your password will sign out all active sessions, including this one.</p>
          <button disabled={busy} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}Update password</button>
        </form>
      </Card>
    </div>
  </>;
}

function Input({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" {...props} /></label>;
}
