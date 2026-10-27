import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { isCurrentAdminAuthenticated } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!await isCurrentAdminAuthenticated()) redirect("/admin/login");
  return <div className="admin-shell">
    <header className="admin-topbar">
      <Link className="admin-brand" href="/admin" aria-label="Project Beej admin home">
        <Image src="/assets/logo-wordmark.png" alt="Project Beej" width={108} height={58} priority />
        <span>Content studio</span>
      </Link>
      <nav aria-label="Admin navigation">
        <Link href="/admin">Editor</Link>
        <a href="https://admin.shopify.com" target="_blank" rel="noreferrer">Shopify Admin ↗</a>
        <AdminLogoutButton />
      </nav>
    </header>
    {children}
  </div>;
}
