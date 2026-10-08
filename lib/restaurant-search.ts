export type Restaurant = {
  id: string;
  name: string;
  address: string;
  mapsUrl?: string;
  priceLevel?: string;
  hours: string[];
  attributions: { name: string; url?: string }[];
};

const mealQueries: Record<string, { lunch: string; dinner: string }> = {
  "01": { lunch: "soba tempura restaurant Asakusa Tokyo", dinner: "Japanese set meal restaurant Ueno Tokyo" },
  "02": { lunch: "curry rice bowl restaurant Harajuku Tokyo", dinner: "ramen udon restaurant Shibuya Tokyo" },
  "03": { lunch: "Japanese lunch restaurant Azabudai Hills Tokyo", dinner: "Japanese set meal restaurant Roppongi Tokyo" },
  "04": { lunch: "seafood rice bowl restaurant Tsukiji Tokyo", dinner: "sushi restaurant Ginza Tokyo" },
  "05": { lunch: "soup curry cafe restaurant Shimokitazawa Tokyo", dinner: "Japanese restaurant Shinjuku Tokyo" },
};

function safeHttps(value?: string) {
  if (!value) return undefined;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
}

export function restaurantRequest(day: string | null, meal: string | null, budget: string | null) {
  if (!day || !Object.hasOwn(mealQueries, day) || (meal !== "lunch" && meal !== "dinner") || !["value", "mid", "flex", "premium"].includes(budget ?? "")) return null;
  return {
    textQuery: mealQueries[day][meal],
    includedType: "restaurant", strictTypeFiltering: true,
    languageCode: "en", regionCode: "JP", pageSize: 3,
    ...(budget === "value" ? { priceLevels: ["PRICE_LEVEL_INEXPENSIVE"] }
      : budget === "mid" ? { priceLevels: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"] }
        : budget === "premium" ? { priceLevels: ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"] } : {}),
  };
}

export async function searchRestaurants(request: NonNullable<ReturnType<typeof restaurantRequest>>, apiKey: string, fetcher: typeof fetch = fetch): Promise<Restaurant[]> {
  const response = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.priceLevel,places.regularOpeningHours.weekdayDescriptions,places.businessStatus,places.attributions" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`Restaurant provider status ${response.status}`);
  const data = await response.json() as { places?: {
    id: string; displayName?: { text?: string }; formattedAddress?: string; googleMapsUri?: string;
    priceLevel?: string; businessStatus?: string; regularOpeningHours?: { weekdayDescriptions?: string[] };
    attributions?: { provider?: string; providerUri?: string }[];
  }[] };
  return (data.places ?? []).filter(p => p.id && p.displayName?.text && p.businessStatus === "OPERATIONAL").slice(0, 3).map(p => ({
    id: p.id, name: p.displayName!.text!, address: p.formattedAddress ?? "Address not supplied",
    mapsUrl: safeHttps(p.googleMapsUri), priceLevel: p.priceLevel,
    hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
    attributions: (p.attributions ?? []).map(a => ({ name: a.provider ?? "Data provider", url: safeHttps(a.providerUri) })),
  }));
}
