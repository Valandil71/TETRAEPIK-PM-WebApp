"use client";

// Last-resort boundary for errors in the root layout itself (app/error.tsx handles the rest).
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <button type="button" onClick={reset} style={{ marginTop: "1rem" }}>
          Try Again
        </button>
      </body>
    </html>
  );
}
