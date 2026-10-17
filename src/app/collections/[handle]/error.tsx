"use client";

import { StorefrontDataError } from "@/components/StorefrontDataError";

export default function CollectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StorefrontDataError title="This collection could not load." reset={reset} />;
}
