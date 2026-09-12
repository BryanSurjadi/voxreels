"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authenticate } from "@/lib/auth";

type AuthFormProps = {
  mode: "login" | "register";
  topic?: string;
};

export function AuthForm({ mode, topic }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const data = new FormData(event.currentTarget);

    try {
      await authenticate(mode, {
        email: String(data.get("email")),
        password: String(data.get("password")),
        ...(isRegister && { displayName: String(data.get("displayName")) }),
      });
      router.push(topic ? `/app?topic=${encodeURIComponent(topic)}` : "/app");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed. Try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(360px,0.82fr)_1.18fr]">
      <section className="auth-visual relative hidden overflow-hidden bg-black p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link className="brand relative z-10 text-white" href="/" aria-label="VoxReels home">
          <Image className="invert" src="/logo-transparent.png" alt="" width={46} height={46} priority />
          <span>VoxReels</span>
        </Link>

        <div className="relative z-10 max-w-xl">
          <p className="mb-5 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">Your creative workspace</p>
          <h1 className="text-5xl font-black leading-[0.94] tracking-[-0.06em] xl:text-7xl">
            Start with the thought.<br /><span className="text-zinc-500">Direct every beat.</span>
          </h1>
          <p className="mt-7 max-w-md text-base leading-7 text-zinc-400">
            Your scripts, voice, visuals, and edits stay connected from the first idea to the final reel.
          </p>
        </div>

        <div className="auth-beats relative z-10" aria-hidden="true">
          <span>HOOK</span><i /><span>VALUE</span><i /><span>CTA</span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col bg-[#f7f7f5] px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Link className="brand" href="/" aria-label="VoxReels home">
              <Image src="/logo-transparent.png" alt="" width={42} height={42} priority />
              <span>VoxReels</span>
            </Link>
          </div>
          <p className="text-sm text-zinc-500">
            {isRegister ? "Already have an account?" : "New to VoxReels?"}{" "}
            <Link className="font-semibold text-black underline-offset-4 hover:underline" href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Log in" : "Create account"}
            </Link>
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[470px] flex-1 items-center py-12">
          <div className="w-full">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
              {isRegister ? "Create your workspace" : "Welcome back"}
            </p>
            <h2 className="text-4xl font-black tracking-[-0.05em] sm:text-5xl">
              {isRegister ? "Make your first reel." : "Keep the idea moving."}
            </h2>
            <p className="mt-4 leading-7 text-zinc-500">
              {isRegister
                ? "Create an account to save your idea and shape the script."
                : "Log in to return to your scripts, assets, and edits."}
            </p>

            {topic && isRegister && (
              <div className="mt-7 rounded-2xl border border-zinc-300 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-zinc-400">Your reel idea</p>
                <p className="line-clamp-2 text-sm leading-6 text-zinc-700">{topic}</p>
              </div>
            )}

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              {isRegister && (
                <label className="block text-sm font-semibold">
                  Your name
                  <input className="auth-input" name="displayName" type="text" autoComplete="name" minLength={2} maxLength={80} placeholder="Alex Morgan" required />
                </label>
              )}
              <label className="block text-sm font-semibold">
                Email
                <input className="auth-input" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
              <label className="block text-sm font-semibold">
                Password
                <input className="auth-input" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={8} maxLength={128} placeholder="At least 8 characters" required />
              </label>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

              <button className="button button-dark mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Log in"}
              </button>
            </form>

          </div>
        </div>
      </section>
    </main>
  );
}
