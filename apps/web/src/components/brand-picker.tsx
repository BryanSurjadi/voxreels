"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/auth";

export type Brand = { id: string; name: string; slug: string };

type BrandPickerProps = {
  brands: Brand[];
  disabled?: boolean;
  onCreated: (brand: Brand) => void;
  onUpdated: (brand: Brand) => void;
  onChange: (brandId: string) => void;
  value: string;
};

export function BrandPicker({ brands, disabled, onCreated, onUpdated, onChange, value }: BrandPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editor, setEditor] = useState<"create" | "rename" | null>(null);
  const [brandName, setBrandName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = brands.find((brand) => brand.id === value);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function openEditor(mode: "create" | "rename") {
    setError("");
    setBrandName(mode === "rename" ? selected?.name ?? "" : "");
    setEditor(mode);
  }

  async function saveBrand() {
    const name = brandName.trim();
    if (name.length < 2) return setError("Brand name must contain at least 2 characters.");
    setError("");
    setIsSaving(true);

    try {
      const brand = await apiRequest<Brand>(editor === "rename" ? `/brands/${value}` : "/brands", {
        method: editor === "rename" ? "PATCH" : "POST",
        body: JSON.stringify({ name }),
      });
      if (editor === "rename") onUpdated(brand);
      else {
        onCreated(brand);
        onChange(brand.id);
      }
      setEditor(null);
      setIsOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Brand could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative" ref={pickerRef}>
      <input type="hidden" name="brandId" value={value} />
      <button
        className="flex h-11 min-w-[230px] items-center gap-3 rounded-full border border-zinc-300 bg-white px-2.5 pr-4 text-left text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,.05)] transition hover:border-zinc-500 disabled:opacity-50"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-black text-white">
          {selected?.name.slice(0, 2).toUpperCase() ?? "BR"}
        </span>
        <span className="min-w-0 flex-1 truncate">{selected?.name ?? "Select brand"}</span>
        <svg aria-hidden="true" className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20">
          <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[300px] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.16)]" aria-label="Choose brand">
          <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Your brands</p>
          <div role="listbox">
            {brands.map((brand) => (
              <button
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${brand.id === value ? "bg-black font-semibold text-white" : "hover:bg-zinc-100"}`}
                key={brand.id}
                type="button"
                role="option"
                aria-selected={brand.id === value}
                onClick={() => { onChange(brand.id); setEditor(null); }}
              >
                <span className={`h-2 w-2 rounded-full ${brand.id === value ? "bg-white" : "bg-zinc-300"}`} />
                <span className="truncate">{brand.name}</span>
                {brand.id === value && <span className="ml-auto" aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>

          <div className="mt-1 border-t border-zinc-100 pt-1">
            {editor ? (
              <div className="p-2">
                <label className="text-xs font-semibold" htmlFor="brand-name">{editor === "rename" ? "Rename brand" : "Brand name"}</label>
                <input
                  className="auth-input !mt-2 !min-h-10 !rounded-xl"
                  id="brand-name"
                  value={brandName}
                  minLength={2}
                  maxLength={80}
                  placeholder="Your brand"
                  autoFocus
                  onChange={(event) => setBrandName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); void saveBrand(); }
                    if (event.key === "Escape") setEditor(null);
                  }}
                />
                {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
                <div className="mt-3 flex gap-2">
                  <button className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold" type="button" onClick={() => setEditor(null)}>Cancel</button>
                  <button className="flex-1 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" type="button" disabled={isSaving} onClick={() => void saveBrand()}>{isSaving ? "Saving…" : "Save"}</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <button className="rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-zinc-100" type="button" onClick={() => openEditor("create")}>＋ New brand</button>
                <button className="rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-zinc-100 disabled:text-zinc-300" type="button" disabled={!selected} onClick={() => openEditor("rename")}>✎ Rename</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
