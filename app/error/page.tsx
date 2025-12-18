import { Suspense } from "react";

import ErrorPageClient from "./error-page-client";

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <ErrorPageClient />
    </Suspense>
  );
}
