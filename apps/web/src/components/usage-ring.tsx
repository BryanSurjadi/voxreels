export type Usage = {
  plan: "FREE" | "PRO";
  creditLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
  limit: number;
  used: number;
};

export function UsageRing({ usage }: { usage: Usage }) {
  const percent = Math.min(100, usage.creditsUsed / usage.creditLimit * 100);
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-[0_12px_35px_rgba(0,0,0,.04)] sm:gap-5 sm:p-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full p-1.5" style={{ background: `conic-gradient(#111111 ${percent}%, #e4e4e7 0)` }} aria-hidden="true">
        <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
          <span className="text-2xl font-black leading-none">{usage.creditsRemaining}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-500">left</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500">{usage.plan === "FREE" ? "Free" : "Pro"} · Monthly usage</p>
        <p className="mt-1 text-sm font-bold sm:text-base">{usage.creditsUsed} of {usage.creditLimit} generations used</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Scripts, AI rewrites, and voice batches use 1 each. B-roll uses 1 per image.</p>
        <p className="mt-1 font-mono text-[10px] text-zinc-400">Text tokens: {usage.used.toLocaleString()} / {usage.limit.toLocaleString()}</p>
      </div>
    </div>
  );
}
