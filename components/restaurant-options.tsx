"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Restaurant } from "@/lib/restaurant-search";
import { evidenceTime,type EvidenceAccess } from "@/components/route-check-panel";

const priceLabels: Record<string, string> = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "Inexpensive", PRICE_LEVEL_MODERATE: "Moderate", PRICE_LEVEL_EXPENSIVE: "Expensive", PRICE_LEVEL_VERY_EXPENSIVE: "Very expensive" };

export function RestaurantOptions({ day, meal, budget, area, label,access }: { day: string; meal: "Lunch" | "Dinner"; budget: string; area: string; label?: string;access?:EvidenceAccess }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string>();
  const [source,setSource]=useState<"google_places"|"openstreetmap">(),[note,setNote]=useState(""),[cached,setCached]=useState(false);
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${day === "04" && meal === "Dinner" ? "sushi" : "restaurants"} ${area} Tokyo Japan`)}`;

  async function lookup() {
    if(!access)return;setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/restaurants?${new URLSearchParams({ day, meal: meal.toLowerCase(), budget,group:access.code })}`, { cache: "no-store",headers:{Authorization:`Bearer ${access.token}`},signal:AbortSignal.timeout(25000) });
      const data = await response.json() as { restaurants?: Restaurant[]; checkedAt?: string; message?: string;source?:"google_places"|"openstreetmap";note?:string;cached?:boolean };
      if (!response.ok) throw new Error(data.message ?? "Restaurant lookup failed. Please try again.");
      setRestaurants(data.restaurants ?? []); setSelected(undefined); setCheckedAt(data.checkedAt);
      setSource(data.source);setNote(data.note??"");setCached(!!data.cached);
      if (!data.restaurants?.length) setMessage("No directory candidates returned for this search. Explore more options on Google Maps.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Restaurant lookup failed. Please try again.");
    } finally { setLoading(false); }
  }

  return <div className="mt-4 border-t border-[#f2c6bb] pt-3">
    {label && <p className="mb-2 text-sm font-semibold">{label}</p>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" className="rounded-full bg-white" disabled={loading||!access} onClick={lookup}>{loading ? "Finding restaurants…" : restaurants.length ? "Refresh" : "Find restaurants"}</Button><a href={mapsSearch} target="_blank" rel="noopener noreferrer" className="text-sm text-[#315b7d] underline underline-offset-4">Google Maps</a></div>
    {message&&<p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>}
    {restaurants.length > 0 && <div className="mt-3 space-y-3 rounded-xl border border-[#dce4e7] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span translate="no" className="font-sans text-sm font-medium text-[#5e5e5e]">{source==="openstreetmap"?"OpenStreetMap · via Photon":"Google Maps"}</span><span className="text-xs text-muted-foreground">{checkedAt ? `${cached?"Cached query":"Queried"} ${evidenceTime(checkedAt)}` : "Query date unavailable"}</span></div>
      {source==="openstreetmap"&&<p className="text-xs text-muted-foreground">Prices, hours &amp; budget fit unverified.</p>}
      {note&&<details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-2">Search details</summary><p className="mt-2 leading-5">{note}</p></details>}
      {restaurants.map(restaurant => <div key={restaurant.id} className={`rounded-xl border p-3 ${selected === restaurant.id ? "border-[#315b7d] bg-[#edf4f7]" : "border-[#e2e9eb]"}`}>
        <h4 className="text-base font-semibold">{restaurant.name}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{restaurant.address}</p><p className="mt-1 text-xs text-muted-foreground">Price: {priceLabels[restaurant.priceLevel ?? ""] ?? "Unknown"}{!restaurant.hours.length?" · Hours unknown":""}</p>
        {!!restaurant.hours.length&&<details className="mt-2 text-sm"><summary className="cursor-pointer py-2">Hours</summary><ul className="mt-2 space-y-1 text-muted-foreground">{restaurant.hours.map(hour => <li key={hour}>{hour}</li>)}</ul></details>}
        <div className="mt-3 flex flex-wrap items-center gap-3"><Button variant={selected === restaurant.id ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setSelected(restaurant.id)}>{selected === restaurant.id ? "Selected" : "Choose"}</Button>{restaurant.mapsUrl && <a href={restaurant.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#315b7d] underline underline-offset-4">{source==="openstreetmap"?"View on OpenStreetMap":"View on Google Maps"}</a>}</div>
        {restaurant.attributions.map((a, i) => <p key={i} className="mt-2 text-sm text-muted-foreground">{a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a> : a.name}</p>)}
      </div>)}
      <p className="text-xs text-muted-foreground">Choices stay on this page · No reservation made.</p>
    </div>}
  </div>;
}
