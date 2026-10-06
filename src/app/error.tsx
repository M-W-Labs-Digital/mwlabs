"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">This page is temporarily unavailable</h1>
      <p>Please try again. If the problem continues, contact the M&amp;W Labs team.</p>
      <button type="button" onClick={retry} className="w-fit rounded-lg bg-blue-700 px-5 py-3 text-white">Try again</button>
    </main>
  );
}
