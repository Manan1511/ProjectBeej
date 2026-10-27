import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = { title: "Owner sign in", robots: { index: false, follow: false, noarchive: true } };

export default function AdminLoginPage() {
  return <main className="admin-login-page">
    <section className="admin-login-panel" aria-labelledby="admin-login-title">
      <Link className="admin-login-brand" href="/" aria-label="Project Beej storefront home">project<span>beej</span></Link>
      <p className="admin-kicker">Owner access</p>
      <h1 id="admin-login-title">Content studio</h1>
      <p className="admin-login-intro">Sign in to edit the storefront, review a private draft, and publish when it is ready.</p>
      <AdminLoginForm />
      <Link className="admin-back-link" href="/">Back to the storefront</Link>
    </section>
  </main>;
}
