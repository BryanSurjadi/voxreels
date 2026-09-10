"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  service: string;
};

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setError("NEXT_PUBLIC_API_URL is missing");
      return;
    }

    fetch(`${apiUrl}/api/v1/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to reach the API",
        );
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10">
        <p className="mb-2 text-sm uppercase tracking-widest text-violet-400">
          VoxReels
        </p>

        <h1 className="text-3xl font-semibold">System status</h1>

        {health && (
          <p className="mt-6 text-emerald-400">
            API connected: {health.service}
          </p>
        )}

        {!health && !error && (
          <p className="mt-6 text-zinc-400">Checking API connection…</p>
        )}

        {error && <p className="mt-6 text-red-400">Connection failed: {error}</p>}
      </section>
    </main>
  );
}