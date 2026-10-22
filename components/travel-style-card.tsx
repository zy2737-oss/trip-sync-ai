"use client";
import { useState } from "react";
import { Camera, Coffee, Compass, HeartHandshake, Landmark, Utensils, Sparkles, Download } from "lucide-react";
import { travelStyles, styleTitle, groupStyleNotes, type StyleId, type StyleResult } from "@/lib/travel-personality";

const icons = { slow: Coffee, landmark: Camera, food: Utensils, culture: Landmark, spontaneous: Compass, together: HeartHandshake };
export function StyleIcon({ id, className = "h-6 w-6" }: { id: StyleId; className?: string }) { const Icon = icons[id]; return <Icon aria-hidden="true" className={className} />; }

export function TravelStyleCard({ result, name }: { result: StyleResult | null; name?: string }) {
  const [saved, setSaved] = useState("");
  const primary = result && !result.balanced ? travelStyles[result.primary[0]] : null;
  async function saveCard() {
    if (!result) return;
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 1000;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#17384d"; ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = primary?.softColor ?? "#eee9f5"; ctx.beginPath(); ctx.arc(900, 70, 235, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f5b6a9"; ctx.font = "600 23px sans-serif"; ctx.fillText("TRIPSYNC · THIS TRIP'S TRAVEL STYLE", 70, 110);
    function lines(value: string, y: number, size: number, color: string, maxWidth = 840) {
      ctx!.fillStyle = color; ctx!.font = `${size >= 40 ? 600 : 400} ${size}px sans-serif`;
      let line = "";
      for (const word of value.split(" ")) { const next = line ? `${line} ${word}` : word; if (ctx!.measureText(next).width > maxWidth && line) { ctx!.fillText(line, 70, y); y += size * 1.35; line = word; } else line = next; }
      if (line) ctx!.fillText(line, 70, y); return y + size * 1.6;
    }
    let y = lines(name ? `${name}'s travel style` : "Your travel style", 235, 28, "#d4e0e5");
    y = lines(styleTitle(result), y + 25, 58, "#ffffff");
    y = lines(result.balanced ? "Your preferences span several styles. Let the trip, not a label, lead." : result.primary.map(id => travelStyles[id].tagline).join(" "), y + 25, 29, "#d4e0e5");
    if (result.secondary) lines(`With a ${travelStyles[result.secondary].shortName} streak.`, y + 20, 26, "#f5b6a9");
    lines("A playful reflection of six answers, not a psychological assessment. Budget, walking limits and explicit choices always come first.", 805, 21, "#d4e0e5");
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png")); if (!blob) return;
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "tripsync-travel-style.png"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved("Style card saved.");
  }
  return <section aria-label="Your travel style result" className="relative overflow-hidden rounded-3xl bg-[#17384d] p-6 text-white shadow-[0_22px_70px_rgba(23,56,77,.16)] sm:p-9">
    <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-15" style={{ backgroundColor: primary?.softColor ?? "#eee9f5" }} />
    <div className="relative">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f5b6a9]">{name ? `${name}'s travel style` : "Your travel style"} · this trip</p>
      <div className="mt-6 flex flex-wrap gap-3">{result && !result.balanced ? result.primary.map(id => <span key={id} className="grid h-16 w-16 place-items-center rounded-[22px]" style={{ color: travelStyles[id].color, background: travelStyles[id].softColor }}><StyleIcon id={id} className="h-8 w-8" /></span>) : <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-white/10"><Sparkles className="h-8 w-8" /></span>}</div>
      <h1 className="mt-6 text-3xl font-semibold leading-[1.12] tracking-[-0.035em] sm:text-4xl">{result ? styleTitle(result) : "Your next travel chapter"}</h1>
      {result ? <>
        <p className="mt-4 text-lg leading-7 text-white/90">{result.balanced ? "A little of everything, in your own balance." : result.primary.map(id => travelStyles[id].tagline).join(" ")}</p>
        <p className="mt-4 text-sm leading-6 text-white/70">{result.balanced ? "No single style stood out in your answers. That is a useful result too: your explicit preferences and this trip's priorities can lead the way." : result.primary.map(id => travelStyles[id].description).join(" ")}</p>
        {result.secondary && <p className="mt-4 text-sm text-[#f5b6a9]">With a {travelStyles[result.secondary].shortName} streak.</p>}
        {!result.balanced && <div className="mt-6 space-y-3 rounded-2xl bg-white/[0.07] p-4"><p className="text-xs font-semibold uppercase tracking-widest text-[#f5b6a9]">Planning cues, not promises</p>{result.primary.map(id => <p key={id} className="text-sm leading-6 text-white/80">{travelStyles[id].cue}</p>)}</div>}
        <button type="button" onClick={saveCard} className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-medium hover:bg-white/10"><Download className="h-4 w-4" />Save style card</button>
        {saved && <p role="status" className="mt-2 text-xs text-white/70">{saved}</p>}
      </> : <p className="mt-4 text-sm leading-7 text-white/75">Your earlier planning answers are still saved. Take the six travel-style questions to discover your result; we will not invent a personality from your budget or walking limit.</p>}
      <p className="mt-6 text-xs leading-5 text-white/55">A playful reflection of six answers, not a psychological assessment or a permanent label. Your budget, walking limits and explicit planning choices always come first.</p>
    </div>
  </section>;
}

export function GroupTravelStyles({ entries, privateView = false }: { entries: { id: string; name: string; result: StyleResult }[]; privateView?: boolean }) {
  if (!entries.length) return null;
  const notes = privateView ? groupStyleNotes(entries.map(e => e.result)) : [];
  return <section aria-label="Group travel styles" className="rounded-3xl border border-[#dce4e7] bg-white p-5 sm:p-6">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d9513f]">Different styles, one trip</p>
    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Meet your travel mix</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{privateView ? "Styles from submitted profiles help start a conversation. They never override the planning answers below." : "Only styles people chose to share are shown. Their questionnaire answers stay private to them and the organizer."}</p>
    <div className="mt-5 flex flex-wrap gap-3">{entries.map(e => <div key={e.id} className="max-w-full rounded-2xl bg-[#f4f7f7] px-4 py-3"><p className="text-xs font-medium text-muted-foreground">{e.name}</p><p className="mt-1 text-sm font-semibold">{styleTitle(e.result)}</p></div>)}</div>
    {notes.length > 0 && <div className="mt-5 space-y-3 border-t border-[#e2e9eb] pt-4"><p className="text-sm font-semibold">Ideas to discuss before planning</p>{notes.map(note => <p key={note} className="text-sm leading-6 text-muted-foreground">{note}</p>)}</div>}
  </section>;
}
