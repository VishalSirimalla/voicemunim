import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { ArrowRight, Command, LoaderCircle, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { shop, sessionError, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (shop) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (register) {
        await signUp(Object.fromEntries(form.entries()) as Record<string, string>);
      } else {
        await signIn(String(form.get("email")), String(form.get("password")));
      }
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not complete sign in.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_0.92fr]">
      <section className="hidden flex-col justify-between bg-[#103d32] p-12 text-white lg:flex xl:p-16">
        <Link to="/login" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Command className="h-5 w-5" /></span>
          <span><span className="block font-bold">VoiceMunim</span><span className="text-xs text-emerald-100/70">A calmer way to run your shop</span></span>
        </Link>
        <div className="max-w-xl">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-emerald-100">Made for everyday business</span>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.12] tracking-tight">Your shop,<br />in good hands.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-emerald-50/75">Keep a clear view of stock, customer balances, and daily sales — all in one place.</p>
        </div>
        <p className="text-xs text-emerald-100/60">Private by design. Every shop sees only its own business data.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[410px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white"><Command className="h-5 w-5" /></span>
            <span className="font-bold">VoiceMunim</span>
          </div>
          <div className="mb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{register ? "Get started" : "Welcome back"}</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">{register ? "Create your shop account" : "Sign in to your shop"}</h2>
            <p className="mt-2 text-sm text-slate-500">{register ? "Set up your workspace to get started." : "Enter your details to continue to your workspace."}</p>
          </div>
          {(error || sessionError) && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error || `Could not verify your saved session: ${sessionError}`}</div>}
          <form onSubmit={submit} className="space-y-4">
            {register && <>
              <Field label="Shop name" name="shopName" required autoComplete="organization" />
              <Field label="Owner name" name="ownerName" required autoComplete="name" />
            </>}
            <Field label="Email address" name="email" type="email" required autoComplete="email" />
            {register && <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" minLength={7} />}
            <Field label="Password" name="password" type="password" required autoComplete={register ? "new-password" : "current-password"} minLength={register ? 10 : undefined} />
            {register && <p className="text-xs leading-5 text-slate-500">Use at least 10 characters for your password.</p>}
            <button disabled={busy} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>{register ? "Create account" : "Sign in"} <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-700" /> Your business data stays in your shop workspace.</div>
          <p className="mt-8 text-center text-sm text-slate-500">
            {register ? "Already have an account?" : "New to VoiceMunim?"}{" "}
            <Link className="font-semibold text-emerald-800 hover:underline" to={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  ...props
}: { label: string; name: string; type?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="block text-sm font-medium text-slate-700">{label}<input className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10" name={name} type={type} {...props} /></label>;
}
