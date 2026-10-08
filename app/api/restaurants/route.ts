import { env } from "cloudflare:workers";
import { restaurantRequest, searchRestaurants } from "@/lib/restaurant-search";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const search = restaurantRequest(query.get("day"), query.get("meal"), query.get("budget"));
  if (!search) return Response.json({ message: "Choose a valid trip day, meal, and budget." }, { status: 400, headers });
  if (!env.GOOGLE_PLACES_API_KEY) return Response.json({ code: "NOT_CONFIGURED", message: "Live restaurant search is not connected yet. You can still explore this meal on Google Maps." }, { status: 503, headers });
  try {
    const restaurants = await searchRestaurants(search, env.GOOGLE_PLACES_API_KEY);
    return Response.json({ restaurants, source: "google_places", checkedAt: new Date().toISOString() }, { headers });
  } catch {
    return Response.json({ code: "PROVIDER_UNAVAILABLE", message: "Restaurant search is temporarily unavailable. Try again or explore on Google Maps." }, { status: 502, headers });
  }
}
