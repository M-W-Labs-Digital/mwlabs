"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", maxWidth: "40rem", margin: "auto" }}>
        <h1>Something went wrong</h1>
        <p>M&amp;W Labs is temporarily unavailable. Please try again.</p>
        <button type="button" onClick={retry}>Try again</button>
      </body>
    </html>
  );
}
