import { env } from "cloudflare:workers";

const demoPlaces = [
  { id: "sensoji", name: "Sensō-ji", area: "Asakusa", rating: 4.5, priceLevel: "Free", status: "Operational", source: "demo" },
  { id: "teamlab", name: "teamLab Borderless", area: "Azabudai Hills", rating: 4.6, priceLevel: "$$", status: "Operational", source: "demo" },
  { id: "meiji", name: "Meiji Jingu", area: "Harajuku", rating: 4.6, priceLevel: "Free", status: "Operational", source: "demo" },
  { id: "museum", name: "Tokyo National Museum", area: "Ueno", rating: 4.5, priceLevel: "$", status: "Operational", source: "demo" },
  { id: "shibuya", name: "Shibuya Sky", area: "Shibuya", rating: 4.6, priceLevel: "$$", status: "Operational", source: "demo" },
  { id: "tsukiji", name: "Tsukiji Outer Market", area: "Tsukiji", rating: 4.2, priceLevel: "$", status: "Operational", source: "demo" },
];

export async function GET() {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ places: demoPlaces, source: "demo", message: "Google Places adapter is ready; add GOOGLE_PLACES_API_KEY to enable live results." });
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.businessStatus",
      },
      body: JSON.stringify({ textQuery: "top tourist attractions in Tokyo Japan", pageSize: 10, languageCode: "en" }),
    });

    if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
    const data = (await response.json()) as {
      places?: Array<{ id: string; displayName?: { text?: string }; formattedAddress?: string; rating?: number; priceLevel?: string; businessStatus?: string }>;
    };
    const places = (data.places ?? []).slice(0, 6).map((place) => ({
      id: place.id,
      name: place.displayName?.text ?? "Tokyo attraction",
      area: place.formattedAddress?.split(",")[0] ?? "Tokyo",
      rating: place.rating,
      priceLevel: place.priceLevel?.replace("PRICE_LEVEL_", "") ?? "Unknown",
      status: place.businessStatus?.replace("BUSINESS_STATUS_", "") ?? "Unknown",
      source: "google_places",
    }));
    return Response.json({ places: places.length ? places : demoPlaces, source: places.length ? "google_places" : "demo" }, { headers: { "Cache-Control": "public, max-age=1800" } });
  } catch (error) {
    console.error("Places refresh failed", error);
    return Response.json({ places: demoPlaces, source: "demo", message: "Live place data is temporarily unavailable." });
  }
}
