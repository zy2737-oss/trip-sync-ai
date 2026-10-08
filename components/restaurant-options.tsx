"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Restaurant } from "@/lib/restaurant-search";

const priceLabels: Record<string, string> = { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "Inexpensive", PRICE_LEVEL_MODERATE: "Moderate", PRICE_LEVEL_EXPENSIVE: "Expensive", PRICE_LEVEL_VERY_EXPENSIVE: "Very expensive" };

export function RestaurantOptions({ day, meal, budget, area, label }: { day: string; meal: "Lunch" | "Dinner"; budget: string; area: string; label?: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checkedAt, setCheckedAt] = useState<string>();
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${day === "04" && meal === "Dinner" ? "sushi" : "restaurants"} ${area} Tokyo Japan`)}`;

  async function lookup() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/restaurants?${new URLSearchParams({ day, meal: meal.toLowerCase(), budget })}`, { cache: "no-store" });
      const data = await response.json() as { restaurants?: Restaurant[]; checkedAt?: string; message?: string };
      if (!response.ok) throw new Error(data.message ?? "Restaurant lookup failed. Please try again.");
      setRestaurants(data.restaurants ?? []); setSelected(undefined); setCheckedAt(data.checkedAt);
      if (!data.restaurants?.length) setMessage("No matching restaurants found for this price band. Explore more options on Google Maps.");
    } catch (error) {
      setRestaurants([]); setSelected(undefined); setCheckedAt(undefined);
      setMessage(error instanceof Error ? error.message : "Restaurant lookup failed. Please try again.");
    } finally { setLoading(false); }
  }

  return <div className="mt-4 border-t border-[#f2c6bb] pt-3">
    {label && <p className="mb-2 text-sm font-semibold">{label}</p>}
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" className="rounded-full bg-white" disabled={loading} onClick={lookup}>{loading ? "Finding restaurants…" : restaurants.length ? "Refresh candidates" : "Find real restaurants"}</Button><a href={mapsSearch} target="_blank" rel="noopener noreferrer" className="text-sm text-[#315b7d] underline underline-offset-4">Explore on Google Maps</a></div>
    <a href="/data-use" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-muted-foreground underline underline-offset-4">Data use & terms</a>
    <p role="status" aria-live="polite" className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
    {restaurants.length > 0 && <div className="mt-3 space-y-3 rounded-xl border border-[#dce4e7] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span translate="no" className="whitespace-nowrap font-sans text-sm font-normal text-[#5e5e5e]">Google Maps</span><span className="text-sm text-muted-foreground">Checked {checkedAt ? new Date(checkedAt).toLocaleTimeString("en", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }) : "just now"} JST</span></div>
      {restaurants.map(restaurant => <div key={restaurant.id} className={`rounded-xl border p-3 ${selected === restaurant.id ? "border-[#315b7d] bg-[#edf4f7]" : "border-[#e2e9eb]"}`}>
        <h4 className="text-base font-semibold">{restaurant.name}</h4><p className="mt-1 text-sm leading-6 text-muted-foreground">{restaurant.address}</p><p className="mt-1 text-sm">Price band: {priceLabels[restaurant.priceLevel ?? ""] ?? "Not supplied"}</p>
        <details className="mt-2 text-sm"><summary className="cursor-pointer">Usual opening hours</summary><ul className="mt-2 space-y-1 text-muted-foreground">{restaurant.hours.length ? restaurant.hours.map(hour => <li key={hour}>{hour}</li>) : <li>Hours not supplied. Check directly with the restaurant.</li>}</ul></details>
        <div className="mt-3 flex flex-wrap items-center gap-3"><Button variant={selected === restaurant.id ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setSelected(restaurant.id)}>{selected === restaurant.id ? "Selected for this meal" : "Choose this restaurant"}</Button>{restaurant.mapsUrl && <a href={restaurant.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#315b7d] underline underline-offset-4">View on Google Maps</a>}</div>
        {restaurant.attributions.map((a, i) => <p key={i} className="mt-2 text-sm text-muted-foreground">{a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a> : a.name}</p>)}
      </div>)}
      <p className="text-sm leading-6 text-muted-foreground">Price bands are not menu quotes. Usual hours do not confirm availability on your trip date. Selections last while this itinerary is open and do not make a booking.</p>
    </div>}
  </div>;
}
