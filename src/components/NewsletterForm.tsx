"use client";

import { FormEvent, useState } from "react";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), consent: data.get("consent") === "on", company: data.get("company") || "" }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Sign-up is unavailable right now.");
      form.reset();
      setMessage("You’re in. Watch this space 🌱");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-up is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={submit}>
      <div className="newsletter-fields">
        <label className="sr-only" htmlFor="newsletter-email">Your email</label>
        <input id="newsletter-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="Your email" required />
        <label className="honeypot" aria-hidden="true">Leave this blank<input name="company" tabIndex={-1} autoComplete="off" /></label>
        <button className="button button-sage" type="submit" disabled={busy}>{busy ? "Joining…" : "Join"}</button>
      </div>
      <label className="consent-check"><input type="checkbox" name="consent" required /> <span>I agree to receive occasional email updates. I can unsubscribe anytime.</span></label>
      <p className="form-message" aria-live="polite">{message}</p>
    </form>
  );
}
