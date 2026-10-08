"use client";

import { useState } from "react";
import { ArrowUpRight, Clock, Footprints, ImageIcon, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getAttractionDetail } from "@/lib/attraction-details";

type Choice = "must" | "interested" | "skip";
type Props = {
  place: { id: string; name: string; area: string; rating?: number };
  choice?: Choice;
  canSelectMust: boolean;
  onChoice: (choice: Choice) => void;
};

function AttractionPhoto({ src, alt, large = false }: { src?: string; alt: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // Licensed local photos avoid third-party image requests and API-key exposure.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`w-full object-cover ${large ? "h-52 sm:h-72" : "h-40"}`} />
  ) : <div className={`flex flex-col items-center justify-center gap-2 bg-[#e8efef] text-muted-foreground ${large ? "h-52" : "h-40"}`}><ImageIcon className="h-7 w-7" /><span className="text-sm">Photo unavailable</span></div>;
}

export function AttractionCard({ place, choice, canSelectMust, onChoice }: Props) {
  const detail = getAttractionDetail(place);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.area}, Tokyo, Japan`)}`;
  const choices = (context: string) => <div aria-label={`${place.name} preference ${context}`} className="grid grid-cols-3 gap-1 rounded-xl bg-[#f2f5f5] p-1">{(["must", "interested", "skip"] as const).map((value) => <button key={value} type="button" aria-pressed={choice === value} disabled={value === "must" && !canSelectMust} onClick={() => onChoice(value)} className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${choice === value ? value === "must" ? "bg-[#ef6a53] text-white" : "bg-white text-[#17384d] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{value === "must" ? "Must-visit" : value === "interested" ? "Interested" : "Skip"}</button>)}</div>;

  return <Dialog>
    <Card className="gap-0 overflow-hidden border-[#dce4e7] bg-white py-0 shadow-sm transition hover:shadow-md">
      <DialogTrigger asChild>
        <button type="button" aria-label={`View details for ${place.name}`} className="w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ef6a53]">
          <AttractionPhoto src={detail ? `/attractions/${detail.id}.jpg` : undefined} alt={detail?.photo.alt ?? place.name} />
          <div className="p-4"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{place.name}</p>{place.rating && <Badge variant="secondary">★ {place.rating.toFixed(1)}</Badge>}</div><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{place.area}</p><p className="mt-3 flex items-center gap-1 text-sm font-medium text-[#d9513f]">Explore this place <ArrowUpRight className="h-4 w-4" /></p></div>
        </button>
      </DialogTrigger>
      <div className="px-4 pb-4">{choices("card")}</div>
    </Card>
    <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-2xl [&>button:last-child]:rounded-full [&>button:last-child]:bg-white [&>button:last-child]:p-2 [&>button:last-child]:opacity-100">
      <AttractionPhoto src={detail ? `/attractions/${detail.id}.jpg` : undefined} alt={detail?.photo.alt ?? place.name} large />
      <div className="space-y-5 p-5 sm:p-7">
        <DialogHeader className="text-left"><p className="flex items-center gap-1 text-sm text-[#d9513f]"><MapPin className="h-4 w-4" />{place.area}</p><DialogTitle className="text-2xl leading-tight sm:text-3xl">{place.name}</DialogTitle><DialogDescription className="pt-2 text-base leading-7">{detail?.description ?? "Detailed editorial information is not available for this live result yet. Open the map to explore visitor photos and place information before choosing."}</DialogDescription></DialogHeader>
        {detail && <>
          <section><h3 className="font-semibold">What to look forward to</h3><div className="mt-2 flex flex-wrap gap-2">{detail.highlights.map((highlight) => <Badge key={highlight} variant="secondary" className="px-3 py-1">{highlight}</Badge>)}</div></section>
          <section className="space-y-3 rounded-2xl bg-[#f2f6f6] p-4"><h3 className="font-semibold">Plan your visit</h3><p className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 shrink-0" />Suggested time: {detail.duration}</p><p className="flex items-start gap-2 text-sm leading-6"><Footprints className="mt-1 h-4 w-4 shrink-0" />{detail.walking}</p><p className="text-sm leading-6 text-muted-foreground">{detail.tip}</p></section>
          <p className="text-xs leading-5 text-muted-foreground">Curated overview and estimated visit time—not live opening hours, prices, or availability. Confirm current details before traveling.</p>
        </>}
        <div className="flex flex-wrap gap-4 text-sm font-medium text-[#315b7d]"><a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Open in Google Maps <ArrowUpRight className="h-4 w-4" /></a>{detail && <a href={detail.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Visitor information <ArrowUpRight className="h-4 w-4" /></a>}</div>
        <section className="border-t pt-4"><h3 className="mb-3 font-semibold">How interested are you?</h3>{choices("details")}{!canSelectMust && <p className="mt-2 text-xs text-muted-foreground">You have three must-visits. Change another selection to add this one.</p>}</section>
        {detail && <p className="text-xs leading-5 text-muted-foreground">Photo: {detail.photo.author} / <a href={detail.photo.source} target="_blank" rel="noopener noreferrer" className="underline">Wikimedia Commons</a> · {detail.photo.licenseUrl ? <a href={detail.photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{detail.photo.license}</a> : detail.photo.license}. Displayed cropped; original at source.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
