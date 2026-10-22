import type { CustomActivity } from "./custom-activities.ts";

// The MVP's meal and attraction anchors cover central Tokyo. This box is
// deliberately conservative: places outside it need an excursion decision.
const TOKYO_ANCHOR_BOX = { minLat: 35.62, maxLat: 35.75, minLng: 139.62, maxLng: 139.84 };
const TOKYO_CENTER = { lat: 35.68, lng: 139.76 };

export type OutOfAreaKind = "in_area" | "nearby_excursion" | "cross_city" | "unknown";
export type OutOfAreaDecision = { kind: OutOfAreaKind; label: string; reason: string };

function distanceKm(lat: number, lng: number) {
  const radians = Math.PI / 180;
  const dLat = (lat - TOKYO_CENTER.lat) * radians;
  const dLng = (lng - TOKYO_CENTER.lng) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(TOKYO_CENTER.lat * radians) * Math.cos(lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function classifyOutOfArea(activity: Pick<CustomActivity, "name" | "location" | "description" | "match">): OutOfAreaDecision {
  const text = `${activity.name} ${activity.location} ${activity.description}`.toLowerCase();
  if (TOKYO_ANCHOR_BOX.minLat <= (activity.match?.lat ?? NaN) && (activity.match?.lat ?? NaN) <= TOKYO_ANCHOR_BOX.maxLat && TOKYO_ANCHOR_BOX.minLng <= (activity.match?.lng ?? NaN) && (activity.match?.lng ?? NaN) <= TOKYO_ANCHOR_BOX.maxLng) {
    return { kind: "in_area", label: "Tokyo area", reason: "Within the current Tokyo planning anchors." };
  }
  if (activity.match) {
    const km = distanceKm(activity.match.lat, activity.match.lng);
    return km <= 80
      ? { kind: "nearby_excursion", label: "Tokyo-area excursion", reason: `Outside the Tokyo anchors, about ${Math.round(km)} km from central Tokyo.` }
      : { kind: "cross_city", label: "Cross-city trip", reason: `About ${Math.round(km)} km from central Tokyo; this needs a separate travel decision.` };
  }
  if (/osaka|kyoto|nagoya|sendai|hiroshima|fukuoka|sapporo|hokkaido|nikko/i.test(text)) return { kind: "cross_city", label: "Cross-city trip", reason: "The requested city is outside a Tokyo day trip." };
  if (/kamakura|yokohama|mai?ha?ma|disney|kawagoe|hakone|kawasaki/i.test(text)) return { kind: "nearby_excursion", label: "Tokyo-area excursion", reason: "This place is outside the current Tokyo neighborhood anchors." };
  return { kind: "unknown", label: "Location needs confirmation", reason: "The location is not specific enough to classify safely." };
}
