"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Button } from "@/components/ui/button";
import { buildDailyRoute, directionsUrl, type RouteStopInput } from "@/lib/daily-route";

export function DailyRouteMap({ day, stops }: { day: string; stops: RouteStopInput[] }) {
  const route = useMemo(() => buildDailyRoute(day, stops), [day, stops]);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<number, Marker>());
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [selected, setSelected] = useState<number>();
  const [interactive, setInteractive] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let observer: IntersectionObserver;
    let localMap: LeafletMap | undefined;
    async function createMap() {
      try {
        const L = await import("leaflet");
        if (disposed || !element.current) return;
        localMap = L.map(element.current, { scrollWheelZoom: false, dragging: interactive, touchZoom: interactive, doubleClickZoom: interactive });
        map.current = localMap;
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(localMap);
        tiles.on("tileerror", () => { if (!disposed) setTileError(true); });
        const located = route.filter(s => s.location);
        const groups = new Map<string, typeof located>();
        located.forEach(stop => { const key = `${stop.location!.lat},${stop.location!.lng}`; groups.set(key, [...(groups.get(key) ?? []), stop]); });
        groups.forEach(group => {
          const first = group[0];
          const marker = L.marker([first.location!.lat, first.location!.lng], { icon: L.divIcon({ className: "tripsync-map-pin", html: `<span>${group.map(s => s.number).join("·")}</span>`, iconSize: [44, 36], iconAnchor: [22, 36] }), title: group.map(s => `${s.number}. ${s.title}`).join("; ") }).addTo(localMap!);
          const popup = document.createElement("div");
          group.forEach(stop => { const p = document.createElement("p"); p.textContent = `${stop.number}. ${stop.time} — ${stop.title}${stop.approximate ? " (approximate area)" : ""}`; popup.appendChild(p); markers.current.set(stop.number, marker); });
          marker.bindPopup(popup).on("click", () => setSelected(first.number));
        });
        const coordinates = located.map(s => [s.location!.lat, s.location!.lng] as [number, number]);
        if (coordinates.length > 1) { L.polyline(coordinates, { color: "#315b7d", weight: 3, dashArray: "7 8", opacity: 0.85 }).addTo(localMap); const bounds = L.latLngBounds(coordinates); localMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 }); localMap.on("resize", () => localMap?.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 })); }
        else if (coordinates.length) localMap.setView(coordinates[0], 14);
        else localMap.setView([35.68, 139.74], 11);
        setStatus("ready");
      } catch { if (!disposed) setStatus("failed"); }
    }
    // Request map tiles only for a day currently in view.
    if (element.current) { observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { observer.disconnect(); void createMap(); } }); observer.observe(element.current); }
    return () => { disposed = true; observer?.disconnect(); localMap?.remove(); map.current = null; markers.current.clear(); };
  }, [route]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (interactive) { m.dragging.enable(); m.touchZoom.enable(); m.doubleClickZoom.enable(); }
    else { m.dragging.disable(); m.touchZoom.disable(); m.doubleClickZoom.disable(); }
  }, [interactive, status]);

  function focusStop(number: number) {
    setSelected(number);
    const marker = markers.current.get(number);
    if (marker && map.current) { map.current.panTo(marker.getLatLng(), { animate: false }); marker.openPopup(); }
  }

  function showAll() {
    const coordinates = route.filter(s => s.location).map(s => [s.location!.lat, s.location!.lng] as [number, number]);
    if (coordinates.length && map.current) { map.current.closePopup(); map.current.fitBounds(coordinates, { padding: [35, 35], maxZoom: 15 }); setSelected(undefined); }
  }

  return <section className="mt-5 overflow-hidden rounded-2xl border border-[#c9d7db]" aria-label={`Day ${day} route map`}>
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#edf4f7] p-4"><h3 className="font-semibold">Daily route · Day {day}</h3><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="rounded-full bg-white" disabled={status !== "ready"} onClick={showAll}>Show all stops</Button><Button size="sm" variant="outline" className="rounded-full bg-white" disabled={status !== "ready"} aria-pressed={interactive} onClick={() => setInteractive(v => !v)}>{interactive ? "Lock map for scrolling" : "Enable map gestures"}</Button></div></div>
    <div className="relative"><div ref={element} className={`tripsync-route-map relative z-0 h-72 w-full bg-[#e5ecee] sm:h-80 ${interactive ? "touch-none" : "touch-pan-y"}`} aria-label="Map with numbered stops" />{status !== "ready" && <p role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">{status === "failed" ? "Map unavailable. Use the route list and navigation links below." : "Loading map…"}</p>}</div>
    <div className="space-y-3 p-4"><p className="text-sm leading-6 text-muted-foreground">Dashed lines show visit order, not roads or transit routes. Meals and unconfirmed stops use approximate area pins; overlapping stops share a numbered pin.</p>{tileError && <p role="status" className="text-sm text-[#b74d38]">Some map tiles could not load. The stop list and navigation links still work.</p>}
      <ol aria-label={`Day ${day} map stops`} className="space-y-3">{route.map((stop, i) => {
        const previous = route[i - 1];
        const walking = previous && directionsUrl(previous, stop, "walking");
        const transit = previous && directionsUrl(previous, stop, "transit");
        return <li key={`${stop.number}-${stop.time}`} className={`rounded-xl p-3 ${selected === stop.number ? "bg-[#edf4f7] ring-1 ring-[#315b7d]" : "bg-[#f3f6f6]"}`}><button type="button" className="flex min-h-11 w-full items-start gap-3 text-left" aria-label={`Show stop ${stop.number}: ${stop.title}`} onClick={() => focusStop(stop.number)}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#17384d] text-sm font-semibold text-white">{stop.number}</span><span><span className="block text-sm font-semibold">{stop.title}</span><span className="block text-sm text-muted-foreground">{stop.time} · {stop.location ? `${stop.location.name}${stop.approximate ? " · Approximate area" : ""}` : "Location not confirmed — not plotted"}</span></span></button>{walking && transit && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 pl-11 text-sm text-[#315b7d]"><a href={walking} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{previous.number} to {stop.number}: walking directions</a><a href={transit} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Public transport directions</a></div>}</li>;
      })}</ol>
      <p className="text-xs leading-5 text-muted-foreground">Map: OpenStreetMap. Curated Tokyo reference points checked Oct 8, 2026; not entrance-level accuracy. Hotel and unknown locations are not invented. <a href="/data-use" target="_blank" rel="noopener noreferrer" className="underline">Map data use</a></p>
    </div>
  </section>;
}
