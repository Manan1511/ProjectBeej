import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { getShopifyPolicy } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";

export const metadata: Metadata = { title: "Terms & conditions", description: "Project Beej store terms and conditions." };
export default async function TermsPage() { return <PolicyPage title="Terms & conditions" intro="Publish the merchant-approved terms covering use of the store, product availability, pricing, order acceptance, payments, delivery, and applicable dispute and governing-law details." policy={await getShopifyPolicy("termsOfService", await requestBuyerIp())} />; }
