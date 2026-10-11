import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";
import { getShopifyPolicy } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";

export const metadata: Metadata = { title: "Privacy policy", description: "Project Beej privacy policy." };
export default async function PrivacyPolicyPage() { return <PolicyPage title="Privacy policy" intro="Explain what customer and visitor information this store collects, why it is used, how it is protected, and how customers can contact the business about their information." policy={await getShopifyPolicy("privacyPolicy", await requestBuyerIp())} />; }
