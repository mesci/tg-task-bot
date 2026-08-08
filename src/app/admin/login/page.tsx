"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Invalid secret.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(214,255,60,0.35),transparent_70%)]" />
      <div className="relative overflow-hidden rounded-[28px] border border-line bg-panel p-8 shadow-[0_30px_80px_rgba(18,22,15,0.08)] backdrop-blur">
        <div className="mb-8">
          <p className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-ink">
            taptopia
          </p>
          <p className="mt-3 max-w-sm text-muted">
            Private admin access for the taptopia board.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm uppercase tracking-[0.18em] text-muted">
              Secret
            </span>
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none ring-accent focus:ring-2"
              autoFocus
              required
            />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-ink px-4 py-3 font-medium text-accent transition hover:translate-y-[-1px] disabled:opacity-60"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}
