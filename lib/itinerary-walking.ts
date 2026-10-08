export type WalkingMode = "standard" | "reduced";
type Stop = { time: string; title: string; detail: string; meal?: "Lunch" | "Dinner"; lowWalkingTitle?: string; lowWalkingDetail?: string };

const adjustments: Record<string, Record<string, Partial<Stop>>> = {
  "01": {
    "09:30–11:30": { title: "Sensō-ji: short visit + seated break", detail: "Visit the main temple area, skip the full Nakamise shopping loop, then sit at a nearby café before lunch." },
    "13:00–14:00": { title: "Ride to Ueno + station buffer", detail: "Take the subway, or choose a taxi if station corridors are too much. Allow time to reach the museum entrance without rushing." },
    "14:00–16:00": { title: "One museum exhibition + rest", detail: "Choose one exhibition at Tokyo National Museum instead of touring multiple buildings. Use the remaining time for a seated break; check opening dates first." },
    "16:00–17:30": { title: "Seated café break in Ueno", detail: "Replace the Ameyoko shopping walk with a café stop. Stay in the same area until dinner." },
  },
  "02": {
    "09:30–11:00": { title: "Meiji Jingu: shorter visit", detail: "Use the main shrine route without garden detours. The approach still involves walking; if it exceeds someone's tolerance, let them rest near the station and reconnect afterward." },
    "11:00–12:00": { title: "Seated break near Harajuku Station", detail: "Replace the extra shopping-street walk with a café rest before lunch." },
    "13:00–16:00": { title: "Ride to Shibuya + one stop + rest", detail: "Take the train or an optional taxi. Choose one shop close to the station, then spend the rest of this block seated before the observation deck." },
  },
  "03": {
    "10:00–12:00": { title: "teamLab: shorter visit, flexible exit", detail: "Keep the ticketed experience, but avoid trying to see every room. Standing and walking are still involved; confirm access needs before buying tickets." },
    "13:30–15:00": { title: "Long seated break at Azabudai Hills", detail: "Replace neighborhood browsing with a café break in the same complex after lunch." },
    "15:00–17:00": { title: "Ride to Roppongi + seated downtime", detail: "Skip the shopping loop. Use transit or a taxi and choose a seated café near the dinner area, or rest at the hotel before rejoining." },
  },
  "04": {
    "09:00–11:00": { title: "Tsukiji: one short market stop + rest", detail: "Choose one stall rather than walking every lane. Spend the remaining time seated near the lunch area." },
    "12:30–13:30": { title: "Ride to Ginza + rest", detail: "Use transit or an optional taxi rather than walking between neighborhoods. Keep the following stop near the arrival point." },
    "13:30–16:30": { title: "One Ginza shopping floor + café time", detail: "Visit one department-store floor, then sit for the rest of the block. Skip extra stores and keep the dinner meeting point unchanged." },
  },
  "05": {
    "10:00–12:00": { title: "One Shimokitazawa shop or seated café", detail: "Replace the multi-shop browse with one nearby shop or a café morning. Meet at the existing lunch location." },
    "13:00–14:00": { title: "Ride to Shinjuku + extra station buffer", detail: "Allow time for station corridors. Use an optional taxi if that is more manageable; avoid a walking transfer between neighborhoods." },
    "14:00–16:30": { title: "One gift stop + seated farewell break", detail: "Choose one shop near the station, then rest at a café until dinner. Skip the remaining shopping loop." },
  },
};

export function adjustWalking<T extends Stop>(day: string, stops: T[], mode: WalkingMode): T[] {
  if (mode === "standard") return stops;
  return stops.map(stop => stop.meal ? stop : stop.lowWalkingTitle && stop.lowWalkingDetail
    ? { ...stop, title: stop.lowWalkingTitle, detail: stop.lowWalkingDetail }
    : { ...stop, ...adjustments[day]?.[stop.time] });
}
