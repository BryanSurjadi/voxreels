"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, logout } from "@/lib/auth";
import { BrandPicker, type Brand } from "@/components/brand-picker";
import { RoundedPicker } from "@/components/rounded-picker";

type Project = {
  id: string;
  name: string;
  topic: string | null;
  status: string;
  updatedAt: string;
  brand: Brand;
};
type CurrentUser = {
  user: { displayName: string; email: string };
  activeWorkspaceId: string;
  workspaces: { id: string; name: string; role: "OWNER" | "MEMBER" }[];
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export function Dashboard({ initialTopic }: { initialTopic: string }) {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    Promise.all([
      apiRequest<Brand[]>("/brands"),
      apiRequest<Project[]>("/projects"),
      apiRequest<CurrentUser>("/auth/me"),
    ])
      .then(([brandData, projectData, userData]) => {
        setBrands(brandData);
        setProjects(projectData);
        setMe(userData);
        setSelectedBrandId(brandData[0]?.id ?? "");
      })
      .catch(() => router.replace("/login"))
      .finally(() => setIsLoading(false));
  }, [router]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsCreating(true);
    const data = new FormData(event.currentTarget);

    try {
      const project = await apiRequest<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          topic: String(data.get("topic")),
          brandId: String(data.get("brandId")),
          ...(data.get("goal") && { goal: String(data.get("goal")) }),
          ...(data.get("offer") && { offer: String(data.get("offer")) }),
          ...(data.get("callToAction") && { callToAction: String(data.get("callToAction")) }),
          targetDurationSeconds: Number(data.get("targetDurationSeconds")),
        }),
      });
      router.push(`/app/projects/${project.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Project creation failed.");
    } finally {
      setIsCreating(false);
    }
  }

  async function signOut() {
    await logout();
    router.replace("/");
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <div className="text-center">
          <Image className="mx-auto" src="/logo-transparent.png" alt="" width={70} height={70} priority />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">Opening workspace…</p>
        </div>
      </main>
    );
  }

  const activeWorkspace = me?.workspaces.find((workspace) => workspace.id === me.activeWorkspaceId);
  const initials = me?.user.displayName.slice(0, 2).toUpperCase() ?? "VR";

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#0a0a0a] lg:grid lg:grid-cols-[278px_1fr]">
      {isSidebarOpen && <button className="fixed inset-0 z-40 bg-black/35 lg:hidden" type="button" aria-label="Close sidebar" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`${isSidebarOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 h-screen w-[278px] flex-col border-r border-zinc-200 bg-[#efefed] p-3 lg:sticky lg:top-0 lg:flex`}>
        <div className="flex items-center justify-between">
          <Link className="brand px-2 py-3" href="/app" aria-label="VoxReels home" onClick={() => setIsSidebarOpen(false)}>
            <Image src="/logo-transparent.png" alt="" width={44} height={44} priority />
            <span>VoxReels</span>
          </Link>
          <button className="mr-2 rounded-full p-2 text-xl lg:hidden" type="button" aria-label="Close sidebar" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>

        <button className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-sm font-semibold text-white transition hover:bg-zinc-800" type="button" onClick={() => { setIsSidebarOpen(false); document.getElementById("topic")?.focus(); }}>
          <span aria-hidden="true" className="text-lg leading-none">＋</span> New reel
        </button>

        <nav className="mt-4 space-y-1 text-sm" aria-label="Workspace">
          <a className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 font-semibold shadow-sm" href="#create" onClick={() => setIsSidebarOpen(false)}><span aria-hidden="true">✦</span>Create</a>
          <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-400"><span aria-hidden="true">▱</span>Assets <small className="ml-auto">Soon</small></span>
        </nav>

        <div className="mt-7 flex min-h-0 flex-1 flex-col" id="recent">
          <div className="flex items-center justify-between px-3">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-zinc-500">Recent projects</p>
            <span className="text-xs text-zinc-400">{projects.length}</span>
          </div>
          <div className="mt-2 space-y-1 overflow-y-auto">
            {isLoading && <p className="px-3 py-4 text-sm text-zinc-400">Loading workspace…</p>}
            {!isLoading && projects.length === 0 && <p className="px-3 py-4 text-sm leading-5 text-zinc-500">Your generated scripts will appear here.</p>}
            {projects.map((project) => (
              <Link className="group block w-full rounded-xl px-3 py-2.5 text-left hover:bg-white" href={`/app/projects/${project.id}`} key={project.id} onClick={() => setIsSidebarOpen(false)}>
                <span className="block truncate text-sm font-medium">{project.name}</span>
                <span className="mt-1 flex items-center justify-between text-[11px] capitalize text-zinc-400">
                  {statusLabel(project.status)} <i className="h-1.5 w-1.5 rounded-full bg-zinc-300 group-hover:bg-black" />
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-3 border-t border-zinc-300 pt-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-xs font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{me?.user.displayName ?? "VoxReels user"}</p>
              <p className="truncate text-xs text-zinc-500">{activeWorkspace?.name ?? "Workspace"}</p>
            </div>
            <button className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-white hover:text-black" type="button" onClick={signOut} aria-label="Log out">↗</button>
          </div>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg" type="button" aria-label="Open sidebar" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(true)}>☰</button>
            <Link className="brand" href="/app">
              <Image src="/logo-transparent.png" alt="" width={40} height={40} />
              <span>VoxReels</span>
            </Link>
          </div>
          <div className="hidden items-center gap-2 text-sm text-zinc-500 lg:flex">
            <span className="h-2 w-2 rounded-full bg-black" /> {activeWorkspace?.name ?? "Your workspace"}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 sm:block">Drafts save automatically</span>
            <button className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white lg:hidden" type="button" onClick={signOut}>Log out</button>
          </div>
        </header>

        <div className="mx-auto max-w-[980px] px-5 py-14 sm:px-10 sm:py-20" id="create">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">New project</p>
            <h1 className="mt-4 text-5xl font-black tracking-[-0.065em] sm:text-7xl">What are we making?</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-500 sm:text-lg">Give VoxReels the rough thought. Add direction only where it matters.</p>
          </div>

          <form className="dashboard-composer mx-auto mt-10 max-w-[800px]" onSubmit={createProject}>
            <label className="sr-only" htmlFor="topic">Reel topic</label>
            <textarea id="topic" name="topic" defaultValue={initialTopic} rows={5} minLength={3} maxLength={500} placeholder="Describe your reel topic in one sentence…" required />

            <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BrandPicker
                  brands={brands}
                  value={selectedBrandId}
                  disabled={isLoading}
                  onChange={setSelectedBrandId}
                  onCreated={(brand) => setBrands((current) => [...current, brand].sort((a, b) => a.name.localeCompare(b.name)))}
                  onUpdated={(brand) => setBrands((current) => current.map((item) => item.id === brand.id ? brand : item))}
                />
              </div>
              <button className="button button-dark disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={isCreating || isLoading || brands.length === 0}>
                {isCreating ? "Creating…" : "Create project"}<span aria-hidden="true">→</span>
              </button>
            </div>

            <details className="mt-4 border-t border-zinc-200 pt-4">
              <summary className="cursor-pointer select-none text-sm font-semibold text-zinc-600 hover:text-black">Add creative direction </summary>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Goal<input className="auth-input" name="goal" maxLength={200} placeholder="e.g. Produce a 30-second educational video" /></label>
                <label className="text-sm font-semibold">Offer<input className="auth-input" name="offer" maxLength={200} placeholder="What are you offering?" /></label>
                <label className="text-sm font-semibold sm:col-span-2">Call to action<input className="auth-input" name="callToAction" maxLength={200} placeholder="What should viewers do next?" /></label>
                <div className="text-sm font-semibold">Target length
                  <div className="mt-2 max-w-[230px]"><RoundedPicker name="targetDurationSeconds" value={duration} onChange={setDuration} options={[{ value: "15", label: "15 seconds", badge: "15" }, { value: "30", label: "30 seconds", badge: "30" }, { value: "45", label: "45 seconds", badge: "45" }, { value: "60", label: "60 seconds", badge: "60" }]} /></div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-zinc-400">Need another language? Include it in the topic or goal, such as “in French.”</p>
            </details>
          </form>

          {error && <p className="mx-auto mt-5 max-w-[800px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
          {notice && <p className="mx-auto mt-5 max-w-[800px] rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium" role="status">{notice}</p>}

          <div className="mx-auto mt-12 grid max-w-[800px] gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-3">
            {[["01", "Add the idea"], ["02", "Review the beats"], ["03", "Generate assets"]].map(([number, label]) => (
              <div className="bg-white p-5" key={number}><span className="font-mono text-[10px] text-zinc-400">{number}</span><p className="mt-2 text-sm font-semibold">{label}</p></div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
