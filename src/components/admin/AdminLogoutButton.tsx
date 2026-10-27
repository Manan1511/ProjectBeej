"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      router.replace("/admin/login");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <span className="admin-logout-wrap"><button className="admin-logout" type="button" disabled={busy} onClick={() => void logout()}>{busy ? "Signing out…" : "Sign out"}</button>{error ? <span role="status">{error}</span> : null}</span>;
}
