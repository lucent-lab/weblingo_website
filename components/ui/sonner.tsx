"use client";

import { Toaster } from "sonner";

export function Sonner() {
  return (
    <Toaster
      richColors
      closeButton
      position="top-right"
      duration={4000}
      toastOptions={{
        style: {
          borderColor: "hsl(var(--accent) / 0.55)",
          borderWidth: "1px",
          boxShadow: "0 10px 25px -12px hsl(var(--foreground) / 0.55)",
        },
      }}
    />
  );
}
