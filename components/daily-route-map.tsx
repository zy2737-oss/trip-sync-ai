"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Button } from "@/components/ui/button";
import { buildDailyRoute, type RouteStopInput } from "@/lib/daily-route";

export function DailyRouteMap({ day, stops, selected, focusVersion, onSelect }: { day: string; stops: RouteStopInput[]; selected?:number;focusVersion?:number;onSelect?:(number:number)=>void }) {
  const signature=JSON.stringify(stops);
  const route = useMemo(() => buildDailyRoute(day, stops), [day, signature]);
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<number, Marker>());
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const select=useRef(onSelect);select.current=onSelect;
  const [attempt,setAttempt]=useState(0);
  const [interactive, setInteractive] = useState(false);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let observer: IntersectionObserver;
    let localMap: LeafletMap | undefined;
    async function createMap() {
      try {
        setTileError(false);setStatus("loading");
        const L = await import("leaflet");
        if (disposed || !element.current) return;
        localMap = L.map(element.current, { scrollWheelZoom: false, dragging: interactive, touchZoom: interactive, doubleClickZoom: interactive });
        map.current = localMap;
        // OSM requires a real Referer. Override the page's private-link policy ONLY for public tiles,
        // sending the true origin, never a path, query, recovery fragment or access credential.
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19,referrerPolicy:"origin", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(localMap);
        tiles.once("tileerror", () => { if (!disposed) {tiles.remove();setTileError(true);} });
        const located = route.filter(s => s.location);
        const groups = new Map<string, typeof located>();
        located.forEach(stop => { const key = `${stop.location!.lat},${stop.location!.lng}`; groups.set(key, [...(groups.get(key) ?? []), stop]); });
        groups.forEach(group => {
          const first = group[0];
          const marker = L.marker([first.location!.lat, first.location!.lng], { icon: L.divIcon({ className: "tripsync-map-pin", html: `<span>${group.map(s => s.number).join("·")}</span>`, iconSize: [44, 36], iconAnchor: [22, 36] }), title: group.map(s => `${s.number}. ${s.title}`).join("; ") }).addTo(localMap!);
          const popup = document.createElement("div");
          group.forEach(stop => { const p = document.createElement("p"); p.textContent = `${stop.number}. ${stop.time} — ${stop.title}${stop.approximate ? " (approximate area)" : ""}`; popup.appendChild(p); markers.current.set(stop.number, marker); });
          marker.bindPopup(popup).on("click", () => select.current?.(first.number));
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
  }, [route,attempt]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (interactive) { m.dragging.enable(); m.touchZoom.enable(); m.doubleClickZoom.enable(); }
    else { m.dragging.disable(); m.touchZoom.disable(); m.doubleClickZoom.disable(); }
  }, [interactive, status]);

  useEffect(()=>{
    if(selected===undefined)return;
    const marker = markers.current.get(selected);
    if (marker && map.current) { map.current.panTo(marker.getLatLng(), { animate: false }); marker.openPopup(); }
  },[selected,status,focusVersion]);

  function showAll() {
    const coordinates = route.filter(s => s.location).map(s => [s.location!.lat, s.location!.lng] as [number, number]);
    if (coordinates.length && map.current) { map.current.closePopup(); map.current.fitBounds(coordinates, { padding: [35, 35], maxZoom: 15 }); }
  }

  return <section className="mt-5 overflow-hidden rounded-2xl border border-[#c9d7db]" aria-label={`Day ${day} route map`}>
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#edf4f7] p-4"><h3 className="font-semibold">Daily route · Day {day}</h3><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="rounded-full bg-white" disabled={status !== "ready"} onClick={showAll}>Show all stops</Button><Button size="sm" variant="outline" className="rounded-full bg-white" disabled={status !== "ready"} aria-pressed={interactive} onClick={() => setInteractive(v => !v)}>{interactive ? "Lock map for scrolling" : "Enable map gestures"}</Button></div></div>
    <div className="relative"><div ref={element} className={`tripsync-route-map relative z-0 h-72 w-full bg-[#e5ecee] sm:h-80 ${interactive ? "touch-none" : "touch-pan-y"}`} aria-label="Map with numbered stops" />{status !== "ready" && <p role="status" className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">{status === "failed" ? "Map unavailable. Use the route list and navigation links below." : "Loading map…"}</p>}</div>
    <div className="space-y-3 p-4"><p className="text-xs leading-5 text-muted-foreground">Pins match the numbered activities below. Dashed lines show visit order, not roads or transit routes. Area pins are approximate; shared pins carry multiple activity numbers.</p>{tileError && <div role="status" className="text-sm text-[#b74d38]">Basemap tiles are unavailable. Pins and the numbered itinerary still work. <button type="button" className="min-h-11 underline" onClick={()=>setAttempt(v=>v+1)}>Retry map tiles</button></div>}
      <p className="text-xs leading-5 text-muted-foreground">Map: OpenStreetMap. Curated Tokyo reference points checked Oct 8, 2026; not entrance-level accuracy. Hotel and unknown locations are not invented. <a href="/data-use" target="_blank" rel="noopener noreferrer" className="underline">Map data use</a></p>
    </div>
  </section>;
}
