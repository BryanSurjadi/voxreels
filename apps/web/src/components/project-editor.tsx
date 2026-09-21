"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { apiBlob, apiRequest } from "@/lib/auth";

type MediaAsset = { id: string; name: string; kind: string; status: string };
type VoiceTake = { id: string; status: string };
type Beat = { role: string | null; voiceTakes: VoiceTake[] };
type TimelineItem = {
  id: string;
  mediaAssetId: string | null;
  voiceTakeId: string | null;
  trackType: string;
  order: number;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  text: string | null;
};
type Timeline = { id: string; durationMs: number | null; items: TimelineItem[] };
type Project = {
  id: string;
  name: string;
  mediaAssets: MediaAsset[];
  scriptVersions: Array<{ status: string; beats: Beat[] }>;
  timelines: Timeline[];
};
type LibraryItem = {
  id: string;
  name: string;
  kind: string;
  path: string;
  mediaAssetId?: string;
};

function useMediaUrl(path?: string) {
  const [media, setMedia] = useState({ path: "", url: "" });
  useEffect(() => {
    if (!path) return;
    let objectUrl = "";
    let active = true;
    apiBlob(path).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setMedia({ path, url: objectUrl });
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setMedia({ path, url: "" }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return media.path === path ? media.url : "";
}

function timecode(milliseconds: number) {
  const seconds = Math.max(0, milliseconds) / 1000;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function Stage({ media, item, currentMs, playing, caption }: {
  media?: LibraryItem;
  item?: TimelineItem;
  currentMs: number;
  playing: boolean;
  caption?: string | null;
}) {
  const url = useMediaUrl(media?.path);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!video.current || !item || media?.kind !== "video") return;
    const expected = Math.max(0, (currentMs - item.startMs + item.trimStartMs) / 1000);
    if (Math.abs(video.current.currentTime - expected) > 0.35) {
      video.current.currentTime = expected;
    }
    if (playing) void video.current.play().catch(() => undefined);
    else video.current.pause();
  }, [currentMs, item, media?.kind, playing, url]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {!url && <div className="flex h-full items-center justify-center px-8 text-center text-xs text-zinc-600">Add visual media to the timeline</div>}
      {url && media?.kind === "image" && <Image fill unoptimized className="object-contain" src={url} alt={media.name} />}
      {url && media?.kind === "video" && <video ref={video} className="h-full w-full object-contain" muted playsInline src={url} />}
      {caption && <p className="absolute inset-x-5 bottom-10 rounded-xl bg-black/70 px-4 py-3 text-center text-lg font-bold leading-tight">{caption}</p>}
    </div>
  );
}

function TimelineAudio({ path, item, currentMs, playing }: {
  path?: string;
  item: TimelineItem;
  currentMs: number;
  playing: boolean;
}) {
  const url = useMediaUrl(path);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audio.current || !url) return;
    const active = currentMs >= item.startMs && currentMs < item.startMs + item.durationMs;
    if (!active) { audio.current.pause(); return; }
    const expected = (currentMs - item.startMs + item.trimStartMs) / 1000;
    if (Math.abs(audio.current.currentTime - expected) > 0.35) audio.current.currentTime = expected;
    if (playing) void audio.current.play().catch(() => undefined);
    else audio.current.pause();
  }, [currentMs, item, playing, url]);

  return url ? <audio ref={audio} src={url} preload="auto" /> : null;
}

export function ProjectEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const playStartedAt = useRef(0);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [dirty, setDirty] = useState(false);
  const [dropLane, setDropLane] = useState("");
  const drag = useRef<{ id: string; mode: "move" | "left" | "right"; x: number; width: number; timelineDurationMs: number; startMs: number; durationMs: number; trimStartMs: number; trimsSource: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const timeline = project?.timelines[0];

  async function refresh() {
    const next = await apiRequest<Project>(`/projects/${projectId}`);
    setProject(next);
    setItems(next.timelines[0]?.items ?? []);
    setDirty(false);
  }

  useEffect(() => {
    let active = true;
    void apiRequest<Project>(`/projects/${projectId}`).then((next) => {
      if (!active) return;
      setProject(next);
      setItems(next.timelines[0]?.items ?? []);
    }).catch(() => router.replace("/login"));
    return () => { active = false; };
  }, [projectId, router]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const library = useMemo<LibraryItem[]>(() => {
    if (!project) return [];
    const media = project.mediaAssets
      .filter((asset) => asset.status === "ready")
      .map((asset) => ({
        id: asset.id,
        mediaAssetId: asset.id,
        name: asset.name,
        kind: asset.kind,
        path: `/projects/${projectId}/broll/${asset.id}`,
      }));
    const voices = project.scriptVersions
      .find((version) => version.status === "approved")
      ?.beats.flatMap((beat) => beat.voiceTakes
        .filter((take) => take.status === "ready")
        .slice(0, 1)
        .map((take) => ({
          id: take.id,
          name: `${beat.role ?? "Beat"} voice`,
          kind: "audio",
          path: `/projects/${projectId}/voice/${take.id}`,
        }))) ?? [];
    return [...media, ...voices];
  }, [project, projectId]);

  const durationMs = Math.max(
    timeline?.durationMs ?? 0,
    ...items.map((item) => item.startMs + item.durationMs),
    1000,
  );
  const activeVisualItem = items
    .filter((item) => item.trackType === "visual" && item.mediaAssetId && currentMs >= item.startMs && currentMs < item.startMs + item.durationMs)
    .at(-1);
  const activeVisual = library.find((asset) => asset.mediaAssetId === activeVisualItem?.mediaAssetId);
  const activeCaption = items.find((item) => item.trackType === "text" && currentMs >= item.startMs && currentMs < item.startMs + item.durationMs)?.text;
  const selectedMedia = library.find((asset) => asset.id === selectedMediaId);
  const selectedItem = items.find((item) => item.id === selectedItemId);
  const selectedItemMedia = library.find((asset) => asset.id === (selectedItem?.mediaAssetId ?? selectedItem?.voiceTakeId));
  const lanes = ["visual", "voice", "audio", "text"];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const next = performance.now() - playStartedAt.current;
      if (next >= durationMs) {
        setCurrentMs(durationMs);
        setPlaying(false);
      } else setCurrentMs(next);
    }, 50);
    return () => window.clearInterval(timer);
  }, [durationMs, playing]);

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    const start = currentMs >= durationMs ? 0 : currentMs;
    setCurrentMs(start);
    playStartedAt.current = performance.now() - start;
    setPlaying(true);
  }

  function seek(value: number) {
    setCurrentMs(value);
    playStartedAt.current = performance.now() - value;
  }

  async function upload(file: File) {
    setBusy("upload"); setError("");
    try {
      await apiRequest(`/projects/${projectId}/media`, {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally { setBusy(""); }
  }

  async function addMedia(media: LibraryItem, trackType: "visual" | "audio", startMs = currentMs) {
    if (!timeline || !media.mediaAssetId) return;
    setBusy("drop"); setError("");
    try {
      if (dirty) await saveTimeline();
      await apiRequest(`/projects/${projectId}/timeline/${timeline.id}/items`, {
        method: "POST",
        body: JSON.stringify({
          mediaAssetId: media.mediaAssetId,
          trackType,
          startMs: Math.round(startMs),
          durationMs: Math.min(5000, Math.max(1000, durationMs - startMs)),
        }),
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Media could not be added.");
    } finally { setBusy(""); }
  }

  async function dropOnLane(event: DragEvent<HTMLDivElement>, lane: string) {
    event.preventDefault();
    setDropLane("");
    const payload = event.dataTransfer.getData("text/plain");
    const rectangle = event.currentTarget.getBoundingClientRect();
    const startMs = Math.max(0, Math.min(
      durationMs - 100,
      ((event.clientX - rectangle.left) / rectangle.width) * durationMs,
    ));
    if (!payload.startsWith("media:")) return;
    const media = library.find((asset) => asset.id === payload.slice(6));
    if (!media) return;
    if (lane === "visual" && ["image", "video"].includes(media.kind)) await addMedia(media, "visual", startMs);
    if (lane === "audio" && media.kind === "audio") await addMedia(media, "audio", startMs);
  }

  async function addText() {
    if (!timeline) return;
    setBusy("text"); setError("");
    try {
      if (dirty) await saveTimeline();
      const item = await apiRequest<TimelineItem>(`/projects/${projectId}/timeline/${timeline.id}/items`, {
        method: "POST",
        body: JSON.stringify({ trackType: "text", text: "New caption", startMs: Math.round(currentMs), durationMs: 3000 }),
      });
      await refresh();
      setSelectedItemId(item.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Caption could not be added."); }
    finally { setBusy(""); }
  }

  async function splitClip() {
    if (!timeline || !selectedItem) return;
    setBusy("split"); setError("");
    try {
      if (dirty) await saveTimeline();
      const right = await apiRequest<TimelineItem>(`/projects/${projectId}/timeline/${timeline.id}/items/${selectedItem.id}/split`, {
        method: "POST", body: JSON.stringify({ atMs: Math.round(currentMs) }),
      });
      await refresh();
      setSelectedItemId(right.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Clip could not be split."); }
    finally { setBusy(""); }
  }

  function changeItem(id: string, changes: Partial<TimelineItem>) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setDirty(true);
  }

  function startClipDrag(event: PointerEvent<HTMLDivElement>, item: TimelineItem) {
    if (event.button !== 0) return;
    const laneWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 1;
    const mode = (event.target as HTMLElement).closest("[data-handle]")?.getAttribute("data-handle") as "left" | "right" | null;
    drag.current = { id: item.id, mode: mode ?? "move", x: event.clientX, width: laneWidth, timelineDurationMs: durationMs, startMs: item.startMs, durationMs: item.durationMs, trimStartMs: item.trimStartMs, trimsSource: item.trackType === "audio" || item.trackType === "voice" || (item.trackType === "visual" && library.some((asset) => asset.mediaAssetId === item.mediaAssetId && asset.kind === "video")) };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    setSelectedItemId(item.id);
  }

  function moveClip(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture) return;
    const delta = Math.round((event.clientX - gesture.x) / gesture.width * gesture.timelineDurationMs / 50) * 50;
    if (gesture.mode === "move") changeItem(gesture.id, { startMs: Math.max(0, gesture.startMs + delta) });
    if (gesture.mode === "right") changeItem(gesture.id, { durationMs: Math.max(100, gesture.durationMs + delta) });
    if (gesture.mode === "left") {
      const shift = Math.max(-gesture.startMs, gesture.trimsSource ? -gesture.trimStartMs : -gesture.startMs, Math.min(delta, gesture.durationMs - 100));
      changeItem(gesture.id, { startMs: gesture.startMs + shift, durationMs: gesture.durationMs - shift, trimStartMs: gesture.trimsSource ? Math.max(0, gesture.trimStartMs + shift) : 0 });
    }
  }

  async function saveTimeline() {
    if (!timeline) return;
    await apiRequest(`/projects/${projectId}/timeline/${timeline.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        items: items.map(({ id, startMs, durationMs: itemDuration, trimStartMs, text }) => ({
          id, startMs, durationMs: itemDuration, trimStartMs, text,
        })),
      }),
    });
  }

  async function save() {
    setBusy("save"); setError("");
    try { await saveTimeline(); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Timeline could not be saved."); }
    finally { setBusy(""); }
  }

  async function render() {
    setPlaying(false); setBusy("render"); setError("");
    try {
      await saveTimeline();
      const result = await apiRequest<{ downloadPath: string }>(`/projects/${projectId}/render`, { method: "POST" });
      const blob = await apiBlob(result.downloadPath);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project?.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() ?? "voxreels"}.mp4`;
      link.click();
      URL.revokeObjectURL(url);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Video export failed.");
    } finally { setBusy(""); }
  }

  if (!project) return <main className="flex min-h-screen items-center justify-center bg-[#111] text-xs uppercase tracking-widest text-zinc-500">Opening editor…</main>;
  if (!timeline) return <main className="flex min-h-screen items-center justify-center bg-[#111] p-6 text-white"><div className="text-center"><h1 className="text-3xl font-black">Build the timeline first</h1><Link className="mt-5 inline-block rounded-full bg-white px-5 py-3 text-sm font-bold text-black" href={`/app/projects/${projectId}`}>Back to project</Link></div></main>;

  return (
    <main className="flex min-h-screen flex-col bg-[#111] text-white">
      <header className="flex h-16 items-center gap-3 border-b border-zinc-800 px-4 sm:px-6">
        <Link className="rounded-full border border-zinc-700 px-3 py-2 text-xs" href={`/app/projects/${projectId}`} onClick={(event) => { if (dirty && !window.confirm("Leave without saving timeline changes?")) event.preventDefault(); }}>← Project</Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-bold">{project.name}</h1>
        {dirty && <span className="hidden text-[11px] text-amber-300 sm:inline">Unsaved edits</span>}
        <button className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-bold disabled:opacity-40" disabled={Boolean(busy) || !dirty} onClick={() => void save()}>{busy === "save" ? "Saving…" : "Save changes"}</button>
        <button className="rounded-full bg-white px-4 py-2 text-xs font-black text-black disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void render()}>{busy === "render" ? "Rendering…" : "Export MP4"}</button>
      </header>

      <section className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(340px,1fr)_220px]">
        <aside className="border-r border-zinc-800 bg-[#171717] p-4">
          <div className="flex items-center justify-between">
            <b className="text-xs uppercase tracking-wider">Assets</b>
            <label className="cursor-pointer rounded-full bg-white px-3 py-2 text-[10px] font-bold text-black">
              {busy === "upload" ? "Uploading…" : "+ Upload"}
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">Drag media to a track. Then drag clips to move or pull their edges to trim.</p>
          <div className="mt-4 grid max-h-[55vh] gap-2 overflow-y-auto">
            {library.map((asset) => (
              <div
                draggable={Boolean(asset.mediaAssetId)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("text/plain", `media:${asset.id}`);
                }}
                className={`rounded-xl border p-3 ${selectedMediaId === asset.id ? "border-white bg-white text-black" : "border-zinc-800 bg-[#202020]"}`}
                key={asset.id}
              >
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setSelectedMediaId(asset.id)}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-[10px] uppercase text-white">{asset.kind.slice(0, 3)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{asset.name}</span>
                </button>
                {asset.mediaAssetId && <button className="mt-3 w-full rounded-lg border border-current/20 px-2 py-1.5 text-[10px] font-bold" disabled={Boolean(busy)} onClick={() => void addMedia(asset, asset.kind === "audio" ? "audio" : "visual")}>+ Add at {timecode(currentMs)}</button>}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[500px] flex-col items-center justify-center bg-[#0d0d0d] p-5">
          <div className="aspect-[9/16] h-[min(59vh,650px)] overflow-hidden rounded-[24px] border border-zinc-700 bg-black shadow-2xl">
            <Stage media={activeVisual} item={activeVisualItem} currentMs={currentMs} playing={playing} caption={activeCaption} />
          </div>
          <div className="mt-5 flex w-full max-w-xl items-center gap-3">
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm text-black" onClick={togglePlayback} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
            <span className="w-14 font-mono text-[11px]">{timecode(currentMs)}</span>
            <input className="h-1 flex-1 cursor-pointer accent-white" type="range" min={0} max={durationMs} step={50} value={currentMs} onChange={(event) => seek(Number(event.target.value))} aria-label="Timeline position" />
            <span className="w-14 text-right font-mono text-[11px] text-zinc-500">{timecode(durationMs)}</span>
          </div>
        </section>

        <aside className="border-l border-zinc-800 bg-[#171717] p-5">
          <p className="text-xs font-bold uppercase tracking-wider">Clip settings</p>
          {selectedItem ? <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-zinc-700 bg-[#202020] p-4">
              <p className="truncate text-sm font-bold">{selectedItemMedia?.name ?? (selectedItem.trackType === "text" ? "Caption" : selectedItem.trackType)}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">{selectedItem.trackType} track</p>
            </div>
            {selectedItem.trackType === "text" && <label className="block text-xs font-semibold">On-screen text<textarea className="mt-2 min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-[#222] p-3 text-sm text-white outline-none focus:border-white" maxLength={1000} value={selectedItem.text ?? ""} onChange={(event) => changeItem(selectedItem.id, { text: event.target.value })} /></label>}
            <label className="block text-xs font-semibold">Start on timeline (seconds)<input className="mt-2 w-full rounded-xl border border-zinc-700 bg-[#222] p-3 text-sm text-white outline-none focus:border-white" type="number" min="0" step="0.1" value={selectedItem.startMs / 1000} onChange={(event) => changeItem(selectedItem.id, { startMs: Math.max(0, Math.round(Number(event.target.value || 0) * 1000)) })} /></label>
            <label className="block text-xs font-semibold">Clip length (seconds)<input className="mt-2 w-full rounded-xl border border-zinc-700 bg-[#222] p-3 text-sm text-white outline-none focus:border-white" type="number" min="0.1" step="0.1" value={selectedItem.durationMs / 1000} onChange={(event) => changeItem(selectedItem.id, { durationMs: Math.max(100, Math.round(Number(event.target.value || 0) * 1000)) })} /></label>
            {(selectedItem.trackType === "voice" || selectedItem.trackType === "audio" || selectedItemMedia?.kind === "video") && <label className="block text-xs font-semibold">Start within source (seconds)<input className="mt-2 w-full rounded-xl border border-zinc-700 bg-[#222] p-3 text-sm text-white outline-none focus:border-white" type="number" min="0" step="0.1" value={selectedItem.trimStartMs / 1000} onChange={(event) => changeItem(selectedItem.id, { trimStartMs: Math.max(0, Math.round(Number(event.target.value || 0) * 1000)) })} /></label>}
            <button className="w-full rounded-xl border border-zinc-600 px-3 py-2.5 text-xs font-semibold hover:bg-zinc-700 disabled:opacity-40" disabled={Boolean(busy) || currentMs <= selectedItem.startMs + 100 || currentMs >= selectedItem.startMs + selectedItem.durationMs - 100} onClick={() => void splitClip()}>Split at playhead</button>
            <button className="w-full rounded-xl border border-red-500/40 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/10" onClick={() => { setItems((current) => current.filter((item) => item.id !== selectedItem.id)); setSelectedItemId(""); setDirty(true); }}>Remove from timeline</button>
            <p className="text-[11px] leading-5 text-zinc-500">Edits stay in this page until you save. Removing a clip does not delete its uploaded file or generated asset.</p>
          </div> : <p className="mt-5 text-xs leading-5 text-zinc-500">Select a timeline clip to edit its text, timing, source trim, or remove it. {selectedMedia && `${selectedMedia.name} is selected in Assets.`}</p>}
        </aside>
      </section>

      <section className="border-t border-zinc-800 bg-[#151515] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><b className="text-xs uppercase tracking-wider">Timeline</b><p className="mt-1 text-[11px] text-zinc-500">Drag clips to move · drag edges to trim · select for details</p></div>
          <div className="flex items-center gap-3"><button className="rounded-lg border border-zinc-600 px-3 py-2 text-[11px] font-semibold hover:bg-zinc-700 disabled:opacity-40" disabled={Boolean(busy)} onClick={() => void addText()}>+ Text</button><span className="font-mono text-[10px] text-zinc-500">{timecode(currentMs)} / {timecode(durationMs)}</span></div>
        </div>
        <div className="space-y-1 overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-[64px_1fr] gap-2"><span /><div className="flex justify-between px-1 font-mono text-[10px] text-zinc-500">{Array.from({ length: 6 }, (_, index) => <span key={index}>{timecode(durationMs * index / 5)}</span>)}</div></div>
          {lanes.map((lane) => (
            <div className="grid min-w-[760px] grid-cols-[64px_1fr] gap-2" key={lane}>
              <div className="flex items-center text-[10px] font-bold uppercase text-zinc-500">{lane}</div>
              <div
                className={`relative h-14 rounded-lg border transition-colors ${dropLane === lane ? "border-white bg-zinc-700" : "border-zinc-800 bg-[#242424]"}`}
                onDragEnter={(event) => { event.preventDefault(); setDropLane(lane); }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropLane(""); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                onDrop={(event) => void dropOnLane(event, lane)}
              >
                <i className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white" style={{ left: `${currentMs / durationMs * 100}%` }} />
                {items.filter((item) => item.trackType === lane).map((item) => (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${lane} clip ${item.order + 1}, ${timecode(item.startMs)} to ${timecode(item.startMs + item.durationMs)}`}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedItemId(item.id); } }}
                    onPointerDown={(event) => startClipDrag(event, item)}
                    onPointerMove={moveClip}
                    onPointerUp={() => { drag.current = null; }}
                    onPointerCancel={() => { drag.current = null; }}
                    className={`group absolute inset-y-1 flex touch-none select-none items-center overflow-hidden rounded-md border text-left text-[10px] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${selectedItemId === item.id ? "z-10 border-white ring-2 ring-white/40" : "border-zinc-600"} ${lane === "voice" ? "bg-white text-black" : lane === "visual" ? "bg-[repeating-linear-gradient(135deg,#555_0_6px,#303030_6px_12px)] text-white" : lane === "text" ? "bg-zinc-300 text-black" : "bg-[#111] text-white"}`}
                    style={{
                      left: `${item.startMs / durationMs * 100}%`,
                      width: `${Math.max(item.durationMs / durationMs * 100, 2)}%`,
                    }}
                    key={item.id}
                  >
                    <span data-handle="left" className="h-full w-2 shrink-0 cursor-ew-resize border-r border-current/30 bg-black/10 group-hover:bg-current/20" title="Trim start" />
                    <span className="min-w-0 flex-1 cursor-grab truncate px-2 font-bold active:cursor-grabbing">{item.text || `${lane} ${item.order + 1}`}</span>
                    <span data-handle="right" className="h-full w-2 shrink-0 cursor-ew-resize border-l border-current/30 bg-black/10 group-hover:bg-current/20" title="Trim end" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {items.filter((item) => item.trackType === "voice" || item.trackType === "audio").map((item) => (
        <TimelineAudio
          key={item.id}
          item={item}
          currentMs={currentMs}
          playing={playing}
          path={library.find((asset) => asset.id === (item.voiceTakeId ?? item.mediaAssetId))?.path}
        />
      ))}
      {error && <p className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold shadow-xl" role="alert">{error}</p>}
    </main>
  );
}
