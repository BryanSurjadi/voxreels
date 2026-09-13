"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { apiBlob, apiRequest } from "@/lib/auth";

type MediaAsset = { id: string; name: string; kind: string; sourceType: string; status: string; mimeType: string | null };
type VoiceTake = { id: string; status: string };
type Beat = { id: string; order: number; role: string | null; voiceover: string; voiceTakes: VoiceTake[] };
type TimelineItem = { id: string; mediaAssetId: string | null; voiceTakeId: string | null; trackType: string; trackIndex: number; order: number; startMs: number; durationMs: number; text: string | null };
type Timeline = { id: string; name: string; durationMs: number | null; items: TimelineItem[] };
type Project = { id: string; name: string; targetDurationSeconds: number | null; mediaAssets: MediaAsset[]; scriptVersions: Array<{ status: string; beats: Beat[] }>; timelines: Timeline[] };
type LibraryItem = { id: string; name: string; kind: string; path: string; mediaAssetId?: string };

function Preview({ item }: { item: LibraryItem | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!item) return;
    let nextUrl = "";
    apiBlob(item.path).then((blob) => { nextUrl = URL.createObjectURL(blob); setUrl(nextUrl); }).catch(() => setUrl(""));
    return () => { if (nextUrl) URL.revokeObjectURL(nextUrl); };
  }, [item]);

  if (!item) return <div className="flex h-full items-center justify-center text-center text-xs text-zinc-500">Select media to preview</div>;
  if (!url) return <div className="flex h-full items-center justify-center text-xs text-zinc-500">Loading preview…</div>;
  if (item.kind === "audio") return <div className="flex h-full items-center p-6"><audio className="w-full" controls src={url} /></div>;
  if (item.kind === "video") return <video className="h-full w-full object-contain" controls src={url} />;
  return <div className="relative h-full w-full"><Image fill unoptimized className="object-contain" src={url} alt={item.name} /></div>;
}

export function ProjectEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const timeline = project?.timelines[0];

  async function refresh() {
    const next = await apiRequest<Project>(`/projects/${projectId}`);
    setProject(next);
    setItems(next.timelines[0]?.items ?? []);
  }

  useEffect(() => {
    let active = true;

    void apiRequest<Project>(`/projects/${projectId}`)
      .then((next) => {
        if (!active) return;
        setProject(next);
        setItems(next.timelines[0]?.items ?? []);
      })
      .catch(() => router.replace("/login"));

    return () => {
      active = false;
    };
  }, [projectId, router]);

  const library = useMemo<LibraryItem[]>(() => {
    if (!project) return [];
    const uploadedAndVisuals = project.mediaAssets.filter((asset) => asset.status === "ready").map((asset) => ({ id: asset.id, mediaAssetId: asset.id, name: asset.name, kind: asset.kind, path: `/projects/${projectId}/broll/${asset.id}` }));
    const voices = project.scriptVersions.find((version) => version.status === "approved")?.beats.flatMap((beat) => beat.voiceTakes.filter((take) => take.status === "ready").slice(0, 1).map((take) => ({ id: take.id, name: `${beat.role ?? "Beat"} voice`, kind: "audio", path: `/projects/${projectId}/voice/${take.id}` }))) ?? [];
    return [...uploadedAndVisuals, ...voices];
  }, [project, projectId]);

  const selectedMedia = library.find((asset) => asset.id === selectedMediaId) ?? library.find((asset) => asset.kind !== "audio") ?? library[0] ?? null;
  const durationMs = Math.max(timeline?.durationMs ?? 0, ...items.map((item) => item.startMs + item.durationMs), 1);
  const lanes = ["visual", "voice", "audio", "text"];

  async function upload(file: File) {
    setBusy("upload"); setError("");
    try {
      await apiRequest(`/projects/${projectId}/media`, { method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file });
      await refresh();
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Upload failed."); }
    finally { setBusy(""); }
  }

  async function dropOnLane(event: DragEvent<HTMLDivElement>, trackType: string) {
    event.preventDefault();
    if (!timeline) return;
    const rectangle = event.currentTarget.getBoundingClientRect();
    const startMs = Math.max(0, Math.round(((event.clientX - rectangle.left) / rectangle.width) * durationMs));
    const movedItemId = event.dataTransfer.getData("application/x-voxreels-item");
    if (movedItemId) {
      setItems((current) => current.map((item) => item.id === movedItemId ? { ...item, startMs } : item));
      return;
    }
    const mediaId = event.dataTransfer.getData("application/x-voxreels-media");
    const media = library.find((asset) => asset.id === mediaId && asset.mediaAssetId);
    if (!media || (trackType === "visual" ? !["image", "video"].includes(media.kind) : trackType !== "audio" || media.kind !== "audio")) return;
    setBusy("drop"); setError("");
    try {
      await apiRequest(`/projects/${projectId}/timeline/${timeline.id}/items`, { method: "POST", body: JSON.stringify({ mediaAssetId: media.mediaAssetId, trackType, startMs, durationMs: Math.min(5000, Math.max(1000, durationMs - startMs)) }) });
      await refresh();
    } catch (dropError) { setError(dropError instanceof Error ? dropError.message : "Media could not be added."); }
    finally { setBusy(""); }
  }

  async function saveTimeline() {
    if (!timeline) return;
    setBusy("save"); setError("");
    try {
      await apiRequest(`/projects/${projectId}/timeline/${timeline.id}`, { method: "PATCH", body: JSON.stringify({ items: items.map(({ id, startMs, durationMs: itemDuration }) => ({ id, startMs, durationMs: itemDuration })) }) });
      await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Timeline could not be saved."); }
    finally { setBusy(""); }
  }

  if (!project) return <main className="flex min-h-screen items-center justify-center bg-[#111] text-xs uppercase tracking-widest text-zinc-500">Opening editor…</main>;
  if (!timeline) return <main className="flex min-h-screen items-center justify-center bg-[#111] p-6 text-white"><div className="text-center"><h1 className="text-3xl font-black">Build the timeline first</h1><Link className="mt-5 inline-block rounded-full bg-white px-5 py-3 text-sm font-bold text-black" href={`/app/projects/${projectId}`}>Back to project</Link></div></main>;

  return (
    <main className="flex min-h-screen flex-col bg-[#111] text-white">
      <header className="flex h-16 items-center gap-4 border-b border-zinc-800 px-4 sm:px-6"><Link className="rounded-full border border-zinc-700 px-3 py-2 text-xs" href={`/app/projects/${projectId}`}>← Project</Link><h1 className="min-w-0 flex-1 truncate text-sm font-bold">{project.name}</h1><span className="font-mono text-xs text-zinc-500">{(durationMs / 1000).toFixed(1)}s</span><button className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void saveTimeline()}>{busy === "save" ? "Saving…" : "Save edit"}</button></header>

      <section className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(360px,1fr)_240px]">
        <aside className="border-r border-zinc-800 bg-[#171717] p-4"><div className="flex items-center justify-between"><b className="text-xs uppercase tracking-wider">Media</b><label className="cursor-pointer rounded-full bg-white px-3 py-2 text-[10px] font-bold text-black">{busy === "upload" ? "Uploading…" : "+ Upload"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /></label></div><p className="mt-2 text-[11px] leading-5 text-zinc-500">Drag uploaded media into a compatible timeline lane.</p><div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-1">{library.map((asset) => <button draggable={Boolean(asset.mediaAssetId)} onDragStart={(event) => event.dataTransfer.setData("application/x-voxreels-media", asset.id)} onClick={() => setSelectedMediaId(asset.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selectedMedia?.id === asset.id ? "border-white bg-white text-black" : "border-zinc-800 bg-[#202020]"}`} key={asset.id}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-[10px] uppercase text-white">{asset.kind.slice(0, 3)}</span><span className="min-w-0 truncate text-xs font-semibold">{asset.name}</span></button>)}</div></aside>

        <section className="flex min-h-[520px] items-center justify-center bg-[#0d0d0d] p-6 sm:p-8"><div className="aspect-[9/16] h-[min(64vh,680px)] max-h-full overflow-hidden rounded-[28px] border border-zinc-700 bg-black shadow-2xl"><Preview item={selectedMedia} /></div></section>

        <aside className="border-l border-zinc-800 bg-[#171717] p-5"><p className="text-xs font-bold uppercase tracking-wider">Inspector</p><div className="mt-5 rounded-2xl border border-zinc-800 p-4"><p className="truncate text-sm font-bold">{selectedMedia?.name ?? "Nothing selected"}</p><p className="mt-2 text-xs capitalize text-zinc-500">{selectedMedia?.kind ?? "Select media from the library"}</p></div><div className="mt-6 border-t border-zinc-800 pt-5 text-xs leading-5 text-zinc-500">Generated voice and B-roll are already placed when the timeline is created. Uploads stay in the media library until you drag them below.</div></aside>
      </section>

      <section className="border-t border-zinc-800 bg-[#151515] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><b className="text-xs uppercase tracking-wider">Timeline</b><span className="text-[10px] text-zinc-500">Drag clips horizontally · Save edit when finished</span></div><div className="space-y-1 overflow-x-auto">{lanes.map((lane) => <div className="grid min-w-[760px] grid-cols-[64px_1fr] gap-2" key={lane}><div className="flex items-center text-[10px] font-bold uppercase text-zinc-500">{lane}</div><div className="relative h-12 rounded-lg bg-[#242424]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void dropOnLane(event, lane)}>{items.filter((item) => item.trackType === lane).map((item) => <button draggable onDragStart={(event) => event.dataTransfer.setData("application/x-voxreels-item", item.id)} className={`absolute inset-y-1 overflow-hidden rounded-md border px-2 text-left text-[10px] ${lane === "voice" ? "border-white bg-white text-black" : lane === "visual" ? "border-zinc-500 bg-[repeating-linear-gradient(135deg,#444_0_6px,#2c2c2c_6px_12px)]" : "border-zinc-700 bg-[#111]"}`} style={{ left: `${item.startMs / durationMs * 100}%`, width: `${Math.max(item.durationMs / durationMs * 100, 2)}%` }} key={item.id}>{item.text || `${lane} ${item.order + 1}`}</button>)}</div></div>)}</div></section>
      {error && <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold shadow-xl" role="alert">{error}</p>}
    </main>
  );
}
