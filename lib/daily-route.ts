// WGS84 latitude/longitude from OSM/Photon, checked 2026-10-08.
// Area anchors are orientation points, not restaurant addresses.
export const routeLocations = {
  sensoji: { name: "Sensō-ji", lat: 35.7134032, lng: 139.7955265, area: false, aliases: ["senso-ji", "sensoji", "nakamise"] },
  museum: { name: "Tokyo National Museum", lat: 35.7190448, lng: 139.7759676, area: false, aliases: ["tokyo national museum", "museum exhibition"] },
  meiji: { name: "Meiji Jingu", lat: 35.6748417, lng: 139.6996266, area: false, aliases: ["meiji jingu", "meiji shrine"] },
  shibuyaSky: { name: "Shibuya Sky", lat: 35.6582857, lng: 139.7022617, area: false, aliases: ["shibuya sky"] },
  teamlab: { name: "teamLab Borderless", lat: 35.6620024, lng: 139.7434178, area: false, aliases: ["teamlab", "borderless"] },
  tsukiji: { name: "Tsukiji area", lat: 35.6653884, lng: 139.7704732, area: true, aliases: ["tsukiji"] },
  asakusa: { name: "Asakusa area", lat: 35.7113505, lng: 139.7983284, area: true, aliases: ["asakusa"] },
  ueno: { name: "Ueno area", lat: 35.7118161, lng: 139.7757194, area: true, aliases: ["ueno", "ameyoko"] },
  harajuku: { name: "Harajuku area", lat: 35.6705019, lng: 139.7024144, area: true, aliases: ["harajuku"] },
  shibuya: { name: "Shibuya area", lat: 35.6591162, lng: 139.7001168, area: true, aliases: ["shibuya"] },
  azabudai: { name: "Azabudai Hills area", lat: 35.6614747, lng: 139.7408267, area: true, aliases: ["azabudai"] },
  roppongi: { name: "Roppongi area", lat: 35.6629699, lng: 139.7330779, area: true, aliases: ["roppongi"] },
  ginza: { name: "Ginza area", lat: 35.6727825, lng: 139.7639044, area: true, aliases: ["ginza"] },
  yurakucho: { name: "Yurakucho area", lat: 35.6762245, lng: 139.7622425, area: true, aliases: ["yurakucho"] },
  shimokitazawa: { name: "Shimokitazawa area", lat: 35.6612659, lng: 139.6669207, area: true, aliases: ["shimokitazawa"] },
  shinjuku: { name: "Shinjuku area", lat: 35.6881082, lng: 139.6966251, area: true, aliases: ["shinjuku"] },
} as const;
export type LocationId = keyof typeof routeLocations;
export type RouteStopInput = { time: string; title: string; detail: string; meal?: "Lunch" | "Dinner"; locationId?: LocationId };
export type RouteStop = { number: number; time: string; title: string; locationId?: LocationId; location?: typeof routeLocations[LocationId]; approximate: boolean };
const mealAreas: Record<string, [LocationId, LocationId]> = { "01": ["asakusa", "ueno"], "02": ["harajuku", "shibuya"], "03": ["azabudai", "roppongi"], "04": ["tsukiji", "ginza"], "05": ["shimokitazawa", "shinjuku"] };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function buildDailyRoute(day: string, stops: RouteStopInput[]): RouteStop[] {
  let previous: LocationId | undefined;
  return stops.map((stop, i) => {
    const title = normalize(stop.title);
    const found = (Object.keys(routeLocations) as LocationId[]).find(id => routeLocations[id].aliases.some(a => title.includes(a)));
    let id = stop.locationId ?? found;
    if (stop.meal) id = mealAreas[day]?.[stop.meal === "Lunch" ? 0 : 1];
    if (!id && !/hotel|airport|departure/.test(title) && /rest|break|check-in|free time|downtime|gifts/.test(title)) id = previous;
    if (id) previous = id;
    return { number: i + 1, time: stop.time, title: stop.title, locationId: id, location: id ? routeLocations[id] : undefined, approximate: Boolean(stop.meal || (id && routeLocations[id].area) || (!found && !stop.locationId)) };
  });
}

export function directionsUrl(from: RouteStop, to: RouteStop, mode: "walking" | "transit") {
  if (!from.location || !to.location) return undefined;
  if (from.location.lat === to.location.lat && from.location.lng === to.location.lng) return undefined;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: "1", origin: `${from.location.lat},${from.location.lng}`, destination: `${to.location.lat},${to.location.lng}`, travelmode: mode })}`;
}
