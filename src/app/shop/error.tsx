"use client";

import { StorefrontDataError } from "@/components/StorefrontDataError";

export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StorefrontDataError title="The snacks are taking a moment." reset={reset} />;
}
