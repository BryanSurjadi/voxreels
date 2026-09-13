"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RoundedPicker } from "@/components/rounded-picker";
import { apiBlob, apiRequest } from "@/lib/auth";

type VoiceTake = { id: string; status: string; model: string; voiceId: string | null };
type MediaAsset = { id: string; status: string; mimeType: string | null };
type Beat = {
  id: string;
  order: number;
  role: string | null;
  voiceover: string;
  truthRequirement: string | null;
  voiceTakes: VoiceTake[];
  mediaLinks: Array<{ mediaAsset: MediaAsset }>;
};
type TimelineItem = { id: string; trackType: string; trackIndex: number; order: number; startMs: number; durationMs: number };
type Timeline = { id: string; durationMs: number | null; items: TimelineItem[] };
type ProductionProject = {
  id: string;
  name: string;
  scriptVersions: Array<{ id: string; status: string; beats: Beat[] }>;
  timelines: Timeline[];
};

function MediaPreview({ path, kind }: { path: string; kind: "audio" | "image" }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let objectUrl = "";
    apiBlob(path).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => undefined);
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  if (!url) return <span className="text-xs text-zinc-400">Loading media…</span>;
  if (kind === "audio") return <div><audio className="h-9 w-full" controls preload="none" src={url} /><a className="mt-2 inline-block text-xs font-semibold underline" href={url} download="voiceover.mp3">Download voice</a></div>;
  return <div><div className="relative aspect-[2/3] overflow-hidden rounded-2xl bg-zinc-200"><Image fill unoptimized className="object-cover" src={url} alt="Generated B-roll" /></div><a className="mt-2 inline-block text-xs font-semibold underline" href={url} download="broll.png">Download B-roll</a></div>;
}

export function ProductionWorkspace({ project, onRefresh }: { project: ProductionProject; onRefresh: () => Promise<unknown> }) {
  const script = project.scriptVersions.find((version) => version.status === "approved");
  const beats = script?.beats ?? [];
  const timeline = project.timelines[0];
  const [gender, setGender] = useState("female");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedBroll, setSelectedBroll] = useState<string[]>([]);

  async function run(label: string, action: () => Promise<unknown>, success: string) {
    setBusy(label); setError(""); setNotice("");
    try { await action(); await onRefresh(); setNotice(success); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The action failed."); }
    finally { setBusy(""); }
  }

  async function downloadExport() {
    setBusy("export"); setError("");
    try {
      const result = await apiRequest<{ manifest: object }>(`/projects/${project.id}/export`, { method: "POST" });
      const url = URL.createObjectURL(new Blob([JSON.stringify(result.manifest, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.voxreels.json`; link.click(); URL.revokeObjectURL(url);
      setNotice("Project manifest exported. Download the media files from their beat cards.");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Export failed."); }
    finally { setBusy(""); }
  }

  function toggleBroll(beatId: string) {
    setSelectedBroll((current) => current.includes(beatId) ? current.filter((id) => id !== beatId) : [...current, beatId]);
  }

  if (!script) return null;
  const voiceCount = beats.filter((beat) => beat.voiceTakes.some((take) => take.status === "ready")).length;
  const brollCount = beats.filter((beat) => beat.mediaLinks.some((link) => link.mediaAsset.status === "ready")).length;
  const eligibleBroll = beats.filter((beat) => beat.truthRequirement !== "real_footage_required").length;
  const estimatedBrollCost = selectedBroll.length * 0.01;

  return (
    <section className="mt-12 border-t border-zinc-300 pt-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[.15em] text-zinc-500">Production desk</p><h2 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-5xl">Voice, visuals, cut.</h2></div>
        <p className="max-w-md text-sm leading-6 text-zinc-500">Generate only what you need. Authentic-footage beats are never sent to an image model.</p>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between"><b>Voiceover</b><span className="font-mono text-xs text-zinc-400">{voiceCount}/{beats.length}</span></div>
          <p className="mt-2 text-sm text-zinc-500">ElevenLabs Flash v2.5 · roughly $0.05 per 1,000 characters.</p>
          <div className="mt-5 text-xs font-semibold">Voice<div className="mt-2"><RoundedPicker value={gender} onChange={setGender} options={[{ value: "female", label: "Female voice", badge: "F" }, { value: "male", label: "Male voice", badge: "M" }]} /></div></div>
          <button className="button button-dark mt-4 w-full disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void run("voice", () => apiRequest(`/projects/${project.id}/voice/generate`, { method: "POST", body: JSON.stringify({ gender }) }), "Voiceovers generated.")}>{busy === "voice" ? "Generating voice…" : voiceCount ? "Generate missing voiceovers" : "Generate voiceovers"}</button>
        </article>
        <article className="rounded-3xl bg-black p-6 text-white">
          <div className="flex items-center justify-between"><b>Optional B-roll</b><span className="font-mono text-xs text-zinc-500">{brollCount}/{eligibleBroll}</span></div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">OpenAI Flare · budget roughly $0.01 per low-quality portrait still; actual token use varies.</p>
          <div className="mt-5 rounded-2xl border border-zinc-800 p-4 text-xs leading-5 text-zinc-400">
            Select the beat cards below. Real-footage beats and completed images cannot be selected.
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
            <span>{selectedBroll.length} selected</span>
            <span>Estimated ≤ ${estimatedBrollCost.toFixed(2)}</span>
          </div>
          <button
            className="mt-3 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
            disabled={Boolean(busy) || selectedBroll.length === 0}
            onClick={() => void run(
              "broll",
              async () => {
                await apiRequest(`/projects/${project.id}/broll/generate`, {
                  method: "POST",
                  body: JSON.stringify({ beatIds: selectedBroll }),
                });
                setSelectedBroll([]);
              },
              "Selected B-roll stills generated.",
            )}
          >
            {busy === "broll" ? "Generating B-roll…" : `Generate selected (${selectedBroll.length})`}
          </button>
        </article>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {beats.map((beat) => {
          const voice = beat.voiceTakes.find((take) => take.status === "ready");
          const visual = beat.mediaLinks.find((link) => link.mediaAsset.status === "ready")?.mediaAsset;
          const selectable = beat.truthRequirement !== "real_footage_required" && !visual;
          const checked = selectedBroll.includes(beat.id);
          return (
            <article className={`rounded-3xl border bg-white p-4 transition ${checked ? "border-black ring-2 ring-black" : "border-zinc-200"}`} key={beat.id}>
              <div className="flex items-center justify-between gap-3">
                <b className="text-xs uppercase tracking-wider">{beat.role}</b>
                {selectable ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                    <input className="h-4 w-4 accent-black" type="checkbox" checked={checked} onChange={() => toggleBroll(beat.id)} />
                    B-roll
                  </label>
                ) : (
                  <span className="font-mono text-[10px] text-zinc-400">{visual ? "READY" : "REAL"}</span>
                )}
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-5">{beat.voiceover}</p>
              <div className="mt-4 border-t border-zinc-100 pt-4">{voice ? <MediaPreview kind="audio" path={`/projects/${project.id}/voice/${voice.id}`} /> : <p className="text-xs text-zinc-400">Voice not generated</p>}</div>
              <div className="mt-3">{visual ? <MediaPreview kind="image" path={`/projects/${project.id}/broll/${visual.id}`} /> : <div className="flex aspect-[2/3] items-center justify-center rounded-2xl bg-zinc-100 px-5 text-center text-xs text-zinc-400">{beat.truthRequirement === "real_footage_required" ? "Real footage required" : checked ? "Selected for generation" : "No B-roll selected"}</div>}</div>
            </article>
          );
        })}
      </div>

      {voiceCount === beats.length && beats.length > 0 && (
        <div className="mt-8 rounded-3xl border border-zinc-300 bg-white p-5 sm:p-6" role="status">
          <p className="font-bold">Your production assets are ready.</p>
          <p className="mt-1 text-sm leading-6 text-zinc-500">Download the voiceovers and any generated B-roll directly from the beat cards above. The editor is optional if you only need the finished script and media files.</p>
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-zinc-200 bg-[#efefed] p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><b className="text-lg">Edit timeline</b><p className="mt-1 text-sm text-zinc-500">A lightweight cut sheet built from the approved beats.</p></div>{!timeline && <button className="button button-dark" disabled={Boolean(busy)} onClick={() => void run("timeline", () => apiRequest(`/projects/${project.id}/timeline`, { method: "POST" }), "Timeline created.")}>{busy === "timeline" ? "Building…" : "Build edit timeline"}</button>}</div>
        {timeline && <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#111] p-5 text-white sm:flex-row sm:items-center"><div><p className="font-semibold">Timeline ready</p><p className="mt-1 text-xs text-zinc-400">Generated assets are placed automatically. Upload and arrange your own media in the full editor.</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black" href={`/app/projects/${project.id}/editor`}>Open editor</Link><button className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-semibold" disabled={Boolean(busy)} onClick={() => void downloadExport()}>{busy === "export" ? "Exporting…" : "Export project package"}</button></div></div>}
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {notice && <p className="mt-4 rounded-xl border border-zinc-300 bg-white p-3 text-sm font-medium" role="status">{notice}</p>}
    </section>
  );
}
