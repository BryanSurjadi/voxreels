"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest, logout } from "@/lib/auth";
import { RoundedPicker } from "@/components/rounded-picker";
import { ProductionWorkspace } from "@/components/production-workspace";

type TruthRequirement =
  | "real_footage_required"
  | "real_footage_preferred"
  | "generated_visual_allowed";
type ScriptBeat = {
  id: string;
  order: number;
  role: string | null;
  voiceover: string;
  delivery: string | null;
  onScreenText: string | null;
  visualRequirement: string | null;
  truthRequirement: TruthRequirement | null;
  voiceTakes: Array<{ id: string; status: string; model: string; voiceId: string | null }>;
  mediaLinks: Array<{ mediaAsset: { id: string; status: string; mimeType: string | null } }>;
};
type ScriptVersion = {
  id: string;
  version: number;
  status: string;
  model: string | null;
  totalTokens: number | null;
  beats: ScriptBeat[];
};
type Project = {
  id: string;
  name: string;
  topic: string | null;
  goal: string | null;
  offer: string | null;
  callToAction: string | null;
  targetDurationSeconds: number | null;
  status: string;
  brand: { id: string; name: string; slug: string };
  scriptVersions: ScriptVersion[];
  timelines: Array<{
    id: string;
    durationMs: number | null;
    items: Array<{ id: string; trackType: string; trackIndex: number; order: number; startMs: number; durationMs: number }>;
  }>;
};

const models = [
  { id: "gpt-5.6-terra", name: "Terra", note: "Balanced · recommended" },
  { id: "gpt-5.6-sol", name: "Sol", note: "Higher reasoning" },
  { id: "gpt-5.5", name: "5.5", note: "Previous generation" },
] as const;
const durationOptions = [15, 30, 45, 60].map((seconds) => ({ value: String(seconds), label: `${seconds} seconds`, badge: String(seconds) }));
const footageOptions = [
  { value: "generated_visual_allowed", label: "Generated visual allowed", badge: "AI" },
  { value: "real_footage_preferred", label: "Real footage preferred", badge: "REAL" },
  { value: "real_footage_required", label: "Real footage required", badge: "REAL" },
];

function getProject(projectId: string) {
  return apiRequest<Project>(`/projects/${projectId}`);
}

export function ProjectReview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [beats, setBeats] = useState<ScriptBeat[]>([]);
  const [activeBeat, setActiveBeat] = useState(0);
  const [model, setModel] =
    useState<(typeof models)[number]["id"]>("gpt-5.6-terra");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingBrief, setIsSavingBrief] = useState(false);
  const [isBriefDirty, setIsBriefDirty] = useState(false);
  const [briefDuration, setBriefDuration] = useState("30");
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  async function refresh() {
    const next = await getProject(projectId);
    setProject(next);
    setBeats(next.scriptVersions[0]?.beats ?? []);
    setBriefDuration(String(next.targetDurationSeconds ?? 30));
    setActiveBeat(0);
    setIsDirty(false);
    setIsBriefDirty(false);
    return next;
  }

  useEffect(() => {
    getProject(projectId)
      .then((next) => {
        setProject(next);
        setBeats(next.scriptVersions[0]?.beats ?? []);
        setBriefDuration(String(next.targetDurationSeconds ?? 30));
      })
      .catch(() => router.replace("/login"))
      .finally(() => setIsLoading(false));
  }, [projectId, router]);

  async function generateScript() {
    if (isBriefDirty)
      return setError("Save the project brief before generating a script.");
    setError("");
    setNotice("");
    setIsGenerating(true);
    try {
      await apiRequest<ScriptVersion>(
        `/projects/${projectId}/scripts/generate`,
        {
          method: "POST",
          body: JSON.stringify({ model }),
        },
      );
      await refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Script generation failed.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSavingBrief(true);
    const data = new FormData(event.currentTarget);
    const optional = (name: string) =>
      String(data.get(name) ?? "").trim() || null;
    try {
      await apiRequest(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          topic: String(data.get("topic")),
          goal: optional("goal"),
          offer: optional("offer"),
          callToAction: optional("callToAction"),
          targetDurationSeconds: Number(data.get("targetDurationSeconds")),
        }),
      });
      await refresh();
      setIsBriefDirty(false);
      setNotice("Project brief saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Project brief could not be saved.",
      );
    } finally {
      setIsSavingBrief(false);
    }
  }

  function updateBeat(
    field: keyof Pick<
      ScriptBeat,
      | "voiceover"
      | "delivery"
      | "onScreenText"
      | "visualRequirement"
      | "truthRequirement"
    >,
    value: string,
  ) {
    setBeats((current) =>
      current.map((beat, index) =>
        index === activeBeat ? { ...beat, [field]: value } : beat,
      ),
    );
    setIsDirty(true);
    setNotice("");
  }

  async function saveScript() {
    const script = project?.scriptVersions[0];
    if (!script) return false;
    setError("");
    setNotice("");
    setIsSavingScript(true);
    try {
      await apiRequest(`/projects/${projectId}/scripts/${script.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          beats: beats.map((beat) => ({
            id: beat.id,
            voiceover: beat.voiceover,
            delivery: beat.delivery ?? "",
            onScreenText: beat.onScreenText ?? "",
            visualRequirement: beat.visualRequirement ?? "",
            truthRequirement:
              beat.truthRequirement ?? "generated_visual_allowed",
          })),
        }),
      });
      await refresh();
      setNotice("Script changes saved.");
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Script could not be saved.",
      );
      return false;
    } finally {
      setIsSavingScript(false);
    }
  }

  async function approveScript() {
    const script = project?.scriptVersions[0];
    if (!script) return;
    if (isDirty && !(await saveScript())) return;
    setError("");
    setIsSavingScript(true);
    try {
      await apiRequest(`/projects/${projectId}/scripts/${script.id}/approve`, {
        method: "POST",
      });
      await refresh();
      setNotice(
        "Script approved. Voice and visual generation can use this version next.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Script could not be approved.",
      );
    } finally {
      setIsSavingScript(false);
    }
  }

  async function signOut() {
    await logout();
    router.replace("/");
  }

  if (isLoading || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5]">
        <div className="text-center">
          <Image
            className="mx-auto"
            src="/logo-transparent.png"
            alt=""
            width={70}
            height={70}
            priority
          />
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
            Opening project…
          </p>
        </div>
      </main>
    );
  }

  const script = project.scriptVersions[0];
  const selectedBeat = beats[activeBeat];
  const approved = script?.status === "approved";

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#0a0a0a] lg:grid lg:grid-cols-[260px_1fr]">
      {isSidebarOpen && <button className="fixed inset-0 z-40 bg-black/35 lg:hidden" type="button" aria-label="Close sidebar" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`${isSidebarOpen ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 h-screen w-[260px] flex-col border-r border-zinc-200 bg-[#efefed] p-4 lg:sticky lg:top-0 lg:flex`}>
        <div className="flex items-center justify-between">
          <Link className="brand px-1 py-2" href="/app" aria-label="VoxReels home" onClick={() => setIsSidebarOpen(false)}>
            <Image src="/logo-transparent.png" alt="" width={44} height={44} priority />
            <span>VoxReels</span>
          </Link>
          <button className="rounded-full p-2 text-xl lg:hidden" type="button" aria-label="Close sidebar" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>
        <Link
          className="mt-7 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-white hover:text-black"
          href="/app"
          onClick={() => setIsSidebarOpen(false)}
        >
          ← Back to workspace
        </Link>
        <div className="mt-8">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
            Project flow
          </p>
          <ol className="mt-3 space-y-1">
            {[
              ["1", "Brief", true],
              ["2", "Script", Boolean(script)],
              ["3", "Voice & visuals", approved],
              ["4", "Editor", project.timelines.length > 0],
            ].map(([number, label, complete]) => (
              <li
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${complete ? "bg-white font-semibold text-black" : "text-zinc-400"}`}
                key={String(number)}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${complete ? "bg-black text-white" : "border border-zinc-300"}`}
                >
                  {number}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-auto border-t border-zinc-300 pt-4">
          <button
            className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-zinc-500 hover:bg-white hover:text-black"
            type="button"
            onClick={signOut}
          >
            Log out
          </button>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b border-zinc-200 bg-white/85 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg lg:hidden" type="button" aria-label="Open sidebar" aria-expanded={isSidebarOpen} onClick={() => setIsSidebarOpen(true)}>☰</button>
            <div className="min-w-0">
            <p className="truncate text-sm font-bold">{project.name}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {project.brand.name} · {project.targetDurationSeconds ?? 30}s
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs capitalize text-zinc-500">
              {approved ? "approved" : project.status.replaceAll("_", " ")}
            </span>
            <Link
              className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white lg:hidden"
              href="/app"
            >
              Back
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-8 sm:py-14">
          {!script ? (
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section>
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Project brief
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Edit any field directly, then save before generating.
                  </p>
                </div>
                <form
                  className="mt-6 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-200"
                  onSubmit={saveBrief}
                  onChange={() => setIsBriefDirty(true)}
                >
                  <label className="block bg-white p-6 sm:p-8">
                    <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
                      Topic
                    </span>
                    <textarea
                      className="mt-3 min-h-32 w-full resize-y border-0 bg-transparent p-0 text-3xl font-black leading-tight tracking-[-0.045em] outline-none focus:outline-none focus-visible:outline-none sm:text-5xl"
                      name="topic"
                      defaultValue={project.topic ?? ""}
                      minLength={3}
                      maxLength={500}
                      required
                    />
                  </label>
                  <div className="grid gap-px sm:grid-cols-2">
                    <label className="min-h-32 bg-white p-5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
                        Goal
                      </span>
                      <textarea
                        className="mt-3 min-h-20 w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 outline-none focus:outline-none focus-visible:outline-none"
                        name="goal"
                        defaultValue={project.goal ?? ""}
                        maxLength={200}
                        placeholder="Describe the audience, outcome, duration, and language"
                      />
                    </label>
                    <label className="min-h-32 bg-white p-5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
                        Offer
                      </span>
                      <textarea
                        className="mt-3 min-h-20 w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 outline-none focus:outline-none focus-visible:outline-none"
                        name="offer"
                        defaultValue={project.offer ?? ""}
                        maxLength={200}
                        placeholder="Optional"
                      />
                    </label>
                    <label className="min-h-32 bg-white p-5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
                        Call to action
                      </span>
                      <textarea
                        className="mt-3 min-h-20 w-full resize-y border-0 bg-transparent p-0 text-sm leading-6 outline-none focus:outline-none focus-visible:outline-none"
                        name="callToAction"
                        defaultValue={project.callToAction ?? ""}
                        maxLength={200}
                        placeholder="Optional"
                      />
                    </label>
                    <div className="min-h-32 bg-white p-5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400">
                        Target length
                      </span>
                      <div className="mt-4 max-w-[230px]"><RoundedPicker name="targetDurationSeconds" value={briefDuration} options={durationOptions} onChange={(value) => { setBriefDuration(value); setIsBriefDirty(true); }} /></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white p-5">
                    <p className="text-xs text-zinc-400">
                      {isBriefDirty
                        ? "Unsaved changes — generation is paused."
                        : "Brief is saved and ready."}
                    </p>
                    <button
                      className="button button-dark disabled:cursor-not-allowed disabled:opacity-40"
                      type="submit"
                      disabled={!isBriefDirty || isSavingBrief}
                    >
                      {isSavingBrief ? "Saving…" : "Save brief"}
                    </button>
                  </div>
                </form>
              </section>
              <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,.06)] xl:sticky xl:top-24">
                <p className="text-sm font-bold">Choose a script model</p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Nothing is generated until you press the button.
                </p>
                <div className="mt-5 space-y-2">
                  {models.map((option) => (
                    <button
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${model === option.id ? "border-black bg-black text-white" : "border-zinc-200 hover:border-zinc-400"}`}
                      type="button"
                      key={option.id}
                      onClick={() => setModel(option.id)}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${model === option.id ? "bg-white text-black" : "bg-zinc-100"}`}
                      >
                        {option.name.slice(0, 1)}
                      </span>
                      <span>
                        <b className="block text-sm">{option.name}</b>
                        <small
                          className={
                            model === option.id
                              ? "text-zinc-400"
                              : "text-zinc-500"
                          }
                        >
                          {option.note}
                        </small>
                      </span>
                      {model === option.id && (
                        <span className="ml-auto" aria-hidden="true">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="button button-dark mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  onClick={generateScript}
                  disabled={isGenerating || isBriefDirty}
                >
                  {isGenerating
                    ? "Writing your script…"
                    : isBriefDirty
                      ? "Save brief to generate"
                      : "Generate script"}
                </button>
                <p className="mt-3 text-center text-[11px] text-zinc-400">
                  Counts toward the daily generation limit.
                </p>
              </aside>
            </div>
          ) : (
            <section>
              <div className="border-b border-zinc-200 pb-7">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    {approved ? "Approved script" : "Script draft"}
                  </p>
                  <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-6xl">
                    {project.name}
                  </h1>
                  <p className="mt-3 text-sm text-zinc-500">
                    {approved
                      ? "Approved and locked"
                      : "Review the complete script, then select any beat to edit its words and production notes."}
                  </p>
                </div>
              </div>

              <div
                className="mt-7 flex gap-3 overflow-x-auto pb-3"
                role="tablist"
                aria-label="Script beats"
              >
                {beats.map((beat, index) => (
                  <button
                    className={`min-w-[260px] max-w-[260px] cursor-pointer rounded-2xl border p-4 text-left transition ${index === activeBeat ? "border-black bg-black text-white" : "border-zinc-200 bg-white hover:border-zinc-400"}`}
                    type="button"
                    role="tab"
                    aria-selected={index === activeBeat}
                    key={beat.id}
                    onClick={() => setActiveBeat(index)}
                  >
                    <span className="flex items-center justify-between">
                      <b className="text-xs uppercase tracking-[0.12em]">{beat.role ?? "Script"}</b>
                      <small className="font-mono opacity-50">{String(index + 1).padStart(2, "0")}</small>
                    </span>
                    <span className="mt-3 line-clamp-2 block text-sm leading-5">{beat.voiceover}</span>
                    <span className={`mt-4 grid gap-1 border-t pt-3 text-[10px] leading-4 ${index === activeBeat ? "border-zinc-700 text-zinc-300" : "border-zinc-100 text-zinc-500"}`}>
                      <span><b>Delivery:</b> {beat.delivery || "Natural"}</span>
                      <span className="truncate"><b>Text:</b> {beat.onScreenText || "None"}</span>
                      <span className="truncate"><b>Visual:</b> {beat.visualRequirement || "None"}</span>
                    </span>
                  </button>
                ))}
              </div>

              {selectedBeat && (
                <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="min-h-[520px] rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,.04)] sm:p-10">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                        Full script
                      </p>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {beats.reduce((total, beat) => total + beat.voiceover.length, 0)} chars
                      </span>
                    </div>
                    <div className="mt-8 space-y-7 text-lg leading-8 sm:text-xl cursor-pointer">
                      {beats.map((beat, index) => (
                        <p className={index === activeBeat ? "-mx-3 rounded-xl bg-zinc-100 px-3 py-2" : ""} key={beat.id} onClick={() => setActiveBeat(index)}>
                          <span className="mr-3 align-middle text-[9px] font-black uppercase tracking-wider text-zinc-400">{beat.role}</span>
                          {beat.voiceover}
                        </p>
                      ))}
                    </div>
                  </section>
                  <aside className="h-fit rounded-3xl border border-zinc-200 bg-[#efefed] p-5 xl:sticky xl:top-24">
                    <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">Edit beat {activeBeat + 1}</p><span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">{selectedBeat.role}</span></div>
                    <label className="mt-5 block text-xs font-semibold">
                      Voiceover
                      <textarea
                        className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 outline-none focus:outline-none focus-visible:outline-none"
                        value={selectedBeat.voiceover}
                        disabled={approved}
                        onChange={(event) => updateBeat("voiceover", event.target.value)}
                      />
                    </label>
                    <label className="mt-4 block text-xs font-semibold">
                      Delivery
                      <textarea
                        className="mt-2 min-h-20 w-full resize-y rounded-2xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:outline-none focus-visible:outline-none"
                        value={selectedBeat.delivery ?? ""}
                        disabled={approved}
                        onChange={(event) =>
                          updateBeat("delivery", event.target.value)
                        }
                      />
                    </label>
                    <label className="mt-4 block text-xs font-semibold">
                      On-screen text
                      <textarea
                        className="mt-2 min-h-20 w-full resize-y rounded-2xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:outline-none focus-visible:outline-none"
                        value={selectedBeat.onScreenText ?? ""}
                        disabled={approved}
                        onChange={(event) =>
                          updateBeat("onScreenText", event.target.value)
                        }
                      />
                    </label>
                    <label className="mt-4 block text-xs font-semibold">
                      Visual direction
                      <textarea
                        className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:outline-none focus-visible:outline-none"
                        value={selectedBeat.visualRequirement ?? ""}
                        disabled={approved}
                        onChange={(event) =>
                          updateBeat("visualRequirement", event.target.value)
                        }
                      />
                    </label>
                    <div className="mt-4 text-xs font-semibold">
                      Footage requirement
                      <div className="mt-2"><RoundedPicker value={selectedBeat.truthRequirement ?? "generated_visual_allowed"} options={footageOptions} disabled={approved} onChange={(value) => updateBeat("truthRequirement", value)} /></div>
                    </div>
                  </aside>
                </div>
              )}

              <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl bg-black p-6 text-white sm:flex-row">
                <div>
                  <p className="font-bold">
                    {approved
                      ? "Script approved"
                      : isDirty
                        ? "You have unsaved changes"
                        : "Ready for your review"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {approved
                      ? "The approved words now drive voice, visuals, and the edit timeline below."
                      : "Approval locks this version so later assets use the reviewed text."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!approved && (
                    <>
                      <button
                        className="rounded-full border border-zinc-600 px-5 py-3 text-sm font-semibold hover:border-white disabled:opacity-50"
                        type="button"
                        disabled={!isDirty || isSavingScript}
                        onClick={() => void saveScript()}
                      >
                        {isSavingScript ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                        type="button"
                        disabled={
                          isSavingScript ||
                          beats.some((beat) => !beat.voiceover.trim())
                        }
                        onClick={() => void approveScript()}
                      >
                        Approve script
                      </button>
                    </>
                  )}
                </div>
              </div>
              {approved && <ProductionWorkspace key={project.timelines[0]?.id ?? "production"} project={project} onRefresh={refresh} />}
            </section>
          )}
          {error && (
            <p
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              className="mt-4 rounded-xl border border-zinc-300 bg-white p-3 text-sm font-medium"
              role="status"
            >
              {notice}
            </p>
          )}
        </div>

        {isGenerating && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
              <div className="script-loader mx-auto" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <h2 className="mt-6 text-2xl font-black tracking-[-0.04em]">
                Directing your first draft
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Building the hook, pacing each beat, and matching visuals to the
                voiceover.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
