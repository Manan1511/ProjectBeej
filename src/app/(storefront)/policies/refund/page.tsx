import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { getShopifyPolicy } from "@/lib/storefront";

export const metadata: Metadata = { title: "Refund policy", description: "Project Beej refund policy." };
export default async function RefundPolicyPage() { return <PolicyPage title="Refund policy" intro="Set out the merchant’s approved rules for damaged or incorrect orders, return eligibility, timelines, refunds, and the customer support process." policy={await getShopifyPolicy("refundPolicy")} />; }
