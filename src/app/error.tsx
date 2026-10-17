"use client";

import { StorefrontDataError } from "@/components/StorefrontDataError";

export default function StorefrontError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StorefrontDataError title="The shop is taking a moment." reset={reset} />;
}
