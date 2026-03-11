"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { getUserFriendlyError } from "@/utils/toastHelpers";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const message = getUserFriendlyError(error, "global error boundary");

  useEffect(() => {
    console.error("Unhandled render error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-gray-600">{message}</p>
          <Button onClick={reset}>Try Again</Button>
        </main>
      </body>
    </html>
  );
}
