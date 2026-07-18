"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-panel border border-grid bg-surface p-8 shadow-soft"
    >
      <div className="mb-6">
        <div className="font-display text-2xl font-bold tracking-wide">
          TUTTLE<span className="ml-1 text-base text-accent-dk">OS</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Crash Guy Injury Attorneys — staff sign-in
        </p>
      </div>
      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-muted">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 w-full rounded-lg border border-grid bg-page px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      <label className="mb-4 block text-sm">
        <span className="mb-1 block text-muted">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 w-full rounded-lg border border-grid bg-page px-3 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </label>
      {error && (
        <p className="mb-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-lg bg-accent-dk font-bold text-white hover:brightness-105 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-4 text-xs text-muted">
        MFA is required for production staff accounts. Link each Auth user to{" "}
        <code className="text-ink">core.staff.auth_user_id</code>.
      </p>
    </form>
  );
}
