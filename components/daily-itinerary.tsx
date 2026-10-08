import { Heart, MapPin, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RestaurantOptions } from "@/components/restaurant-options";
import { adjustWalking, type WalkingMode } from "@/lib/itinerary-walking";
import type { AIItinerary } from "@/lib/ai-itinerary";

type Stop = { time: string; title: string; detail: string; meal?: "Lunch" | "Dinner"; cost?: string };
type Day = { day: string; title: string; area: string; people: string; note: string; stops: Stop[] };

export function DailyItinerary({ conflictChoice, budget, walkingMode, generated }: { conflictChoice: string; budget: string; walkingMode: WalkingMode; generated?: AIItinerary }) {
  const sushiDinner: Stop = conflictChoice === "alternative"
    ? { time: "18:30–20:00", meal: "Dinner", title: "Casual sushi together", detail: "Choose a conveyor-belt or set-menu sushi spot around Ginza or Yurakucho. Agree on a per-person limit before ordering.", cost: "¥2,000–3,500 / person" }
    : conflictChoice === "exception"
      ? { time: "18:30–20:30", meal: "Dinner", title: "Group sushi splurge", detail: "Organizer-selected budget exception: everyone joins a premium sushi dinner in Ginza. Confirm each traveler's consent, menu price, and reservation before booking.", cost: "¥10,000–15,000 / person" }
      : { time: "18:30–20:30", meal: "Dinner", title: "Two dinner options, one reunion", detail: "Optional premium sushi in Ginza (¥10,000–15,000), or casual sushi / a rice-bowl set nearby (¥2,000–3,500). Both groups meet at 20:30 outside the same organizer-selected café in Yurakucho.", cost: "¥2,000–3,500 or ¥10,000–15,000 / person" };
  const days: Day[] = [
    { day: "01", title: "Traditional Tokyo", area: "Asakusa · Ueno", people: "Alex + Jordan", note: "Culture · Rest breaks", stops: [
      { time: "09:30–11:30", title: "Sensō-ji & Nakamise", detail: "Explore the temple and browse the shopping street. Take a seated break before lunch; keep souvenir shopping optional." },
      { time: "12:00–13:00", meal: "Lunch", title: "Soba or tempura set in Asakusa", detail: "Find a casual set-menu restaurant near the temple. Pick a place with seating for four and compare menus before joining a queue.", cost: "¥1,200–2,000 / person" },
      { time: "13:00–14:00", title: "Transfer to Ueno + buffer", detail: "Use the subway rather than walking between neighborhoods. Allow time for station navigation and a short rest." },
      { time: "14:00–16:00", title: "Tokyo National Museum", detail: "Focus on one or two exhibitions instead of the entire museum. Check the opening calendar for your travel date; use Ueno Park as a backup if closed." },
      { time: "16:00–17:30", title: "Café rest & optional Ameyoko browse", detail: "Reconnect at a café in Ueno. Anyone who wants more shopping can browse nearby while others stay seated." },
      { time: "18:00–19:30", meal: "Dinner", title: "Japanese set dinner in Ueno", detail: "Choose a teishoku restaurant with fish, chicken, and vegetable choices. Return to the hotel after dinner at your own pace.", cost: "¥1,500–2,500 / person" },
    ] },
    { day: "02", title: "City icons", area: "Harajuku · Shibuya", people: "Maya + Emma", note: "Shopping · Sunset option", stops: [
      { time: "09:30–11:00", title: "Meiji Jingu", detail: "Take the main approach to the shrine and return by the same route. Skip the longer garden loop if anyone needs to limit walking." },
      { time: "11:00–12:00", title: "Harajuku browse", detail: "Choose one shopping street rather than covering the whole district. Keep a meeting point near the station." },
      { time: "12:00–13:00", meal: "Lunch", title: "Curry or rice-bowl lunch in Harajuku", detail: "Choose a seated café or casual restaurant around the station. Allow a full hour for ordering, eating, and resting.", cost: "¥1,200–2,000 / person" },
      { time: "13:00–16:00", title: "Train to Shibuya, shopping & café break", detail: "Visit the crossing and one shopping destination. Reserve the final hour for a seated break before the observation deck." },
      { time: "16:30–18:00", title: "Shibuya Sky — provisional slot", detail: "Use this as a planning placeholder, not a confirmed ticket. Adjust to the available timed entry; use street-level city views if tickets are unavailable." },
      { time: "18:30–20:00", meal: "Dinner", title: "Ramen or udon in Shibuya", detail: "Look for a restaurant that can accommodate four. Check broth ingredients for dietary needs; choose a set-menu restaurant if the group needs more variety.", cost: "¥1,200–2,000 / person" },
    ] },
    { day: "03", title: "Immersive Tokyo", area: "Azabudai · Roppongi", people: "Emma", note: "Ticketed · Gentle afternoon", stops: [
      { time: "10:00–12:00", title: "teamLab Borderless — provisional slot", detail: "Plan around the timed entry you actually purchase. Leave the morning flexible until ticket availability is checked." },
      { time: "12:30–13:30", meal: "Lunch", title: "Casual lunch at Azabudai Hills", detail: "Compare Japanese lunch sets or café options within the complex to avoid an extra neighborhood transfer.", cost: "¥1,500–2,500 / person" },
      { time: "13:30–15:00", title: "Rest & optional neighborhood time", detail: "Stay nearby for coffee, browsing, or a seated break. Agree on a reunion point so nobody has to keep walking." },
      { time: "15:00–17:00", title: "Roppongi browse or hotel reset", detail: "Take transit or a taxi if needed. Choose one indoor shopping stop; travelers who prefer downtime can return to the hotel." },
      { time: "18:00–19:30", meal: "Dinner", title: "Japanese comfort food in Roppongi", detail: "Meet for donburi, grilled fish, or other set meals. Prefer a clear fixed-price menu so everyone can stay within their own budget.", cost: "¥1,800–3,000 / person" },
    ] },
    { day: "04", title: "Food & neighborhoods", area: "Tsukiji · Ginza · Yurakucho", people: "Alex + group choice", note: "Dinner follows your decision", stops: [
      { time: "09:00–11:00", title: "Tsukiji Outer Market", detail: "Browse food stalls and share optional snacks. Check the market and individual shop schedules for the travel date." },
      { time: "11:30–12:30", meal: "Lunch", title: "Market rice bowl or cooked-food set", detail: "Choose a seated lunch near Tsukiji. Offer cooked fish or a non-seafood meal for anyone who does not want raw seafood.", cost: "¥1,800–3,000 / person" },
      { time: "12:30–13:30", title: "Transfer to Ginza & rest", detail: "Take transit if the group needs to save steps. Include a seated break before afternoon shopping." },
      { time: "13:30–16:30", title: "Ginza shopping in one area", detail: "Pick one department store or shopping block. Make extra stores optional and keep a shared café meeting point." },
      { time: "16:30–18:00", title: "Free time & dinner check-in", detail: "Confirm tonight's dinner choice, budget, and meeting point with everyone. Leave travel and queue time before the meal." },
      sushiDinner,
    ] },
    { day: "05", title: "Choose-your-own finale", area: "Shimokitazawa · Shinjuku", people: "Everyone", note: "Flexible · Shared farewell", stops: [
      { time: "10:00–12:00", title: "Shimokitazawa interest blocks", detail: "Choose vintage shopping, bookshops, or a slow café morning. Stay in one neighborhood and agree on a lunch meeting point." },
      { time: "12:00–13:00", meal: "Lunch", title: "Soup curry or café lunch in Shimokitazawa", detail: "Meet for a casual lunch with an easy-to-read menu. Choose an alternative set meal if curry does not suit the group.", cost: "¥1,200–2,000 / person" },
      { time: "13:00–14:00", title: "Train to Shinjuku & buffer", detail: "Allow time for the larger station and a short break. Check luggage storage or hotel arrangements if this is your departure day." },
      { time: "14:00–16:30", title: "Last gifts or downtime", detail: "Keep shopping close to the station. Travelers who are done can sit at a café; everyone reconnects before dinner." },
      { time: "17:30–19:00", meal: "Dinner", title: "Farewell Japanese dinner in Shinjuku", detail: "Choose a restaurant with varied set meals or shared dishes and agree on the bill split. Move this meal earlier if a flight or train departure requires it.", cost: "¥2,000–3,500 / person" },
    ] },
  ];

  return <div className="space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">{generated ? "AI-generated draft" : "Sample schedule"} · Times are local to Tokyo. Meal budgets are illustrative estimates, not live quotes. Choose restaurant candidates below; selecting a restaurant does not make a reservation.</p>
    {generated && <Card className="border-[#dce4e7] bg-white p-5"><p className="font-semibold">How this plan fits</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{generated.summary}</p><h2 className="mt-4 font-semibold">Review before confirming</h2><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{generated.reviewNotes.map((note, i) => <li key={i}>{note}</li>)}</ul></Card>}
    {(generated?.days ?? days).map((day) => <Card key={day.day} className="overflow-hidden border-[#dce4e7] bg-white shadow-sm">
      <div className="grid sm:grid-cols-[88px_1fr]">
        <div className="flex items-center justify-between bg-[#17384d] p-5 text-white sm:flex-col sm:items-start sm:justify-start sm:gap-2"><span className="text-sm font-semibold tracking-[0.16em] text-white/70">DAY</span><span className="text-4xl font-semibold">{day.day}</span></div>
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-semibold">{day.title}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{day.area}</p></div><Badge variant="outline" className="w-fit whitespace-normal border-[#c9d7db]">{walkingMode === "reduced" ? "Less walking · More seated breaks" : day.note}</Badge></div>
          <ol className="mt-5 space-y-3" aria-label={`Day ${day.day} schedule`}>
            {adjustWalking(day.day, day.stops, walkingMode).map((stop) => <li key={`${stop.time}-${stop.title}`} className={`rounded-2xl border p-4 ${stop.meal ? "border-[#f2c6bb] bg-[#fff5f1]" : "border-transparent bg-[#f3f6f6]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums text-[#315b7d]">{stop.time}</span>{stop.meal && <span className="flex items-center gap-1.5 text-sm font-semibold text-[#b74d38]"><Utensils className="h-4 w-4" />{stop.meal}</span>}</div>
              <h3 className="mt-2 text-base font-semibold">{stop.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{stop.detail}</p>
              {stop.cost && <p className="mt-2 text-sm font-medium text-[#17384d]">Estimated meal budget: {stop.cost}</p>}
              {stop.meal && (day.day === "04" && stop.meal === "Dinner" ? <>
                {conflictChoice !== "exception" && <RestaurantOptions key="casual" day={day.day} meal={stop.meal} budget="mid" area="Ginza" label="Casual sushi candidates" />}
                {conflictChoice !== "alternative" && <RestaurantOptions key="premium" day={day.day} meal={stop.meal} budget="premium" area="Ginza" label="Premium sushi candidates" />}
              </> : <RestaurantOptions day={day.day} meal={stop.meal} budget={budget} area={stop.title} />)}
            </li>)}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-sm text-[#315b7d]"><Heart className="h-4 w-4 shrink-0" />Priority interests: {day.people}</p>
        </div>
      </div>
    </Card>)}
  </div>;
}
