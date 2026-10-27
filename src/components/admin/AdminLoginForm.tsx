"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) throw new Error("Admin sign-in is temporarily unavailable.");
      return await response.json() as { configured?: boolean; authenticated?: boolean };
    }).then((result) => {
      if (!active) return;
      setConfigured(result.configured === true);
      if (result.authenticated) router.replace("/admin");
    }).catch(() => { if (active) setConfigured(false); });
    return () => { active = false; };
  }, [router]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Sign-in failed. Try again.");
      setPassword("");
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (configured === false) return <div className="admin-setup-message" role="status">
    <h2>Finish owner setup</h2>
    <p>This site needs an owner password and a session signing secret before admin access is available.</p>
    <code>npm run admin:setup</code>
    <p>Run the command in the project folder, then restart the server.</p>
  </div>;
  if (configured === null) return <p className="admin-loading" role="status">Checking owner access…</p>;

  return <form className="admin-login-form" onSubmit={signIn}>
    <label htmlFor="admin-owner-password">Owner password</label>
    <input id="admin-owner-password" type="password" name="password" autoComplete="current-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
    {message ? <p className="admin-form-error" role="alert">{message}</p> : null}
    <button className="admin-primary-button" type="submit" disabled={busy || password.length < 12}>{busy ? "Checking…" : "Sign in"}</button>
  </form>;
}
