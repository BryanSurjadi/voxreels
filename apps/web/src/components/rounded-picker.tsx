"use client";

import { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string; badge?: string };

type RoundedPickerProps = {
  name?: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function RoundedPicker({ name, value, options, onChange, disabled }: RoundedPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={pickerRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        className="flex h-11 w-full min-w-[210px] items-center gap-3 rounded-full border border-zinc-300 bg-white px-2.5 pr-4 text-left text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,.05)] transition hover:border-zinc-500 focus:outline-none focus-visible:outline-none disabled:opacity-50"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-black px-2 text-[9px] font-black uppercase text-white">{selected?.badge ?? "•"}</span>
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <svg aria-hidden="true" className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-40 w-full min-w-[250px] rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.16)]" role="listbox">
          {options.map((option) => (
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus:outline-none focus-visible:outline-none ${option.value === value ? "bg-black font-semibold text-white" : "hover:bg-zinc-100"}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
            >
              <span className={`h-2 w-2 rounded-full ${option.value === value ? "bg-white" : "bg-zinc-300"}`} />
              <span>{option.label}</span>
              {option.value === value && <span className="ml-auto" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
