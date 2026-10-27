"use client";

import { StorefrontDataError } from "@/components/StorefrontDataError";

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StorefrontDataError title="This snack could not load." reset={reset} />;
}
