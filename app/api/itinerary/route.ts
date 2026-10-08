import { env } from "cloudflare:workers";
import { generateAIItinerary, itineraryInputSchema, ItineraryProviderError } from "@/lib/ai-itinerary";

const headers = { "Cache-Control": "no-store" };
const requests = new Map<string, number>();

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 4096) return Response.json({ message: "Preference request is too large." }, { status: 413, headers });
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ message: "Could not read preferences." }, { status: 400, headers }); }
  if (raw.length > 4096) return Response.json({ message: "Preference request is too large." }, { status: 413, headers });
  let input;
  try { input = itineraryInputSchema.parse(JSON.parse(raw)); } catch { return Response.json({ message: "Please check the questionnaire and dinner choice." }, { status: 400, headers }); }
  if (!env.DEEPSEEK_API_KEY) return Response.json({ message: "AI generation is not connected. You can preview the sample itinerary." }, { status: 503, headers });
  const now = Date.now();
  for (const [key, time] of requests) if (now - time > 60000) requests.delete(key);
  const identity = request.headers.get("cf-connecting-ip") ?? "local";
  if (requests.has(identity)) return Response.json({ message: "Please wait a minute before generating another draft." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  requests.set(identity, now);
  try {
    const itinerary = await generateAIItinerary(input, env.DEEPSEEK_API_KEY, env.DEEPSEEK_MODEL ?? "deepseek-flash");
    return Response.json({ itinerary, source: "deepseek", generatedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    const message = error instanceof ItineraryProviderError && error.status === 402
      ? "The AI account needs credit before generating a trip. You can preview the sample itinerary."
      : error instanceof ItineraryProviderError && error.status === 401
        ? "AI authentication failed. Ask the organizer to check the connection."
        : "AI generation could not produce a complete itinerary. Try again in a minute, or preview the sample.";
    return Response.json({ message }, { status: 502, headers });
  }
}
