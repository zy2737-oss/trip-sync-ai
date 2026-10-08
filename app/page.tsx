"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  CloudSun,
  Footprints,
  Heart,
  MapPin,
  RefreshCw,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DailyItinerary } from "@/components/daily-itinerary";
import type { WalkingMode } from "@/lib/itinerary-walking";
import type { AIItinerary } from "@/lib/ai-itinerary";

type Screen = "lobby" | "quiz" | "profile" | "group" | "itinerary";
type Place = {
  id: string;
  name: string;
  area: string;
  rating?: number;
  priceLevel?: string;
  status?: string;
  source: "google_places" | "demo";
};

const travelers = [
  { name: "Emma", initials: "EM", color: "bg-[#de5b48]", status: "You" },
  { name: "Alex", initials: "AL", color: "bg-[#315b7d]", status: "Complete" },
  { name: "Maya", initials: "MY", color: "bg-[#7c5d91]", status: "Complete" },
  { name: "Jordan", initials: "JO", color: "bg-[#3e8068]", status: "Complete" },
];

const questions = [
  {
    key: "pace",
    eyebrow: "TRAVEL RHYTHM",
    title: "What pace feels like a vacation to you?",
    help: "Choose what you would enjoy for most days, not your most ambitious day.",
    options: [
      ["slow", "Slow & spacious", "Two anchor activities with plenty of breathing room"],
      ["balanced", "Balanced", "Three main activities with a relaxed meal break"],
      ["packed", "Make every hour count", "A full schedule from breakfast through evening"],
    ],
  },
  {
    key: "walking",
    eyebrow: "MOBILITY",
    title: "How much walking works for you each day?",
    help: "We will use the lowest hard limit when building shared days.",
    options: [
      ["light", "Light", "Under 5,000 steps, with frequent rests"],
      ["moderate", "Moderate", "About 5,000–9,000 steps"],
      ["active", "Active", "About 9,000–14,000 steps"],
    ],
  },
  {
    key: "budget",
    eyebrow: "DAILY BUDGET",
    title: "What is your comfortable daily spend?",
    help: "For this prototype, this covers food, local transport, and activities—not lodging.",
    options: [
      ["value", "Under $80", "Value-focused, with mostly free or low-cost activities"],
      ["mid", "$80–$140", "A mix of everyday choices and one or two splurges"],
      ["flex", "$140+", "More flexibility for premium dining and ticketed experiences"],
    ],
  },
  {
    key: "food",
    eyebrow: "FOOD STYLE",
    title: "What kind of food plan sounds best?",
    help: "Specific dietary needs can be added as hard constraints later.",
    options: [
      ["casual", "Local & casual", "Markets, ramen shops, cafés, and neighborhood favorites"],
      ["mixed", "A thoughtful mix", "Casual meals plus one special reservation"],
      ["destination", "Food is the destination", "Build days around restaurants and tasting experiences"],
    ],
  },
  {
    key: "together",
    eyebrow: "GROUP STYLE",
    title: "Does the group need to stay together all day?",
    help: "Short optional splits can resolve conflicts without making anyone compromise every time.",
    options: [
      ["together", "Stay together", "One shared plan from morning to night"],
      ["mostly", "Mostly together", "One optional split is fine if the group reconnects later"],
      ["flexible", "Flexible", "Parallel activities are welcome when preferences diverge"],
    ],
  },
];

const fallbackPlaces: Place[] = [
  { id: "sensoji", name: "Sensō-ji", area: "Asakusa", rating: 4.5, priceLevel: "Free", status: "Operational", source: "demo" },
  { id: "teamlab", name: "teamLab Borderless", area: "Azabudai Hills", rating: 4.6, priceLevel: "$$", status: "Operational", source: "demo" },
  { id: "meiji", name: "Meiji Jingu", area: "Harajuku", rating: 4.6, priceLevel: "Free", status: "Operational", source: "demo" },
  { id: "museum", name: "Tokyo National Museum", area: "Ueno", rating: 4.5, priceLevel: "$", status: "Operational", source: "demo" },
  { id: "shibuya", name: "Shibuya Sky", area: "Shibuya", rating: 4.6, priceLevel: "$$", status: "Operational", source: "demo" },
  { id: "tsukiji", name: "Tsukiji Outer Market", area: "Tsukiji", rating: 4.2, priceLevel: "$", status: "Operational", source: "demo" },
];

const answerLabels: Record<string, string> = {
  slow: "Relaxed pace", balanced: "Balanced pace", packed: "Full schedule",
  light: "Light walking", moderate: "Moderate walking", active: "Active walking",
  value: "Value-focused", mid: "Mid-range budget", flex: "Flexible budget",
  casual: "Local & casual food", mixed: "Mixed dining", destination: "Food-led travel",
  together: "Stay together", mostly: "Mostly together", flexible: "Flexible group time",
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({ pace: "balanced", walking: "moderate", budget: "mid", food: "mixed", together: "mostly" });
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);
  const [placeSource, setPlaceSource] = useState<"google_places" | "demo">("demo");
  const [refreshing, setRefreshing] = useState(false);
  const [placeChoices, setPlaceChoices] = useState<Record<string, "must" | "interested" | "skip">>({ sensoji: "interested", teamlab: "must", meiji: "interested", museum: "skip", shibuya: "must", tsukiji: "interested" });
  const [conflictChoice, setConflictChoice] = useState("optional");
  const [walkingMode, setWalkingMode] = useState<WalkingMode>("standard");
  const [generatedItinerary, setGeneratedItinerary] = useState<AIItinerary>();
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  async function generateItinerary() {
    setGenerating(true); setGenerationError("");
    try {
      const response = await fetch("/api/itinerary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, mustVisits: places.filter(place => placeChoices[place.id] === "must").map(place => place.name), conflictChoice }),
      });
      const data = await response.json() as { itinerary?: AIItinerary; message?: string };
      if (!response.ok || !data.itinerary) throw new Error(data.message ?? "Could not generate this itinerary.");
      setGeneratedItinerary(data.itinerary); setWalkingMode(answers.walking === "light" ? "reduced" : "standard"); setScreen("itinerary");
    } catch (error) { setGenerationError(error instanceof Error ? error.message : "Generation failed. Try again."); }
    finally { setGenerating(false); }
  }

  async function refreshPlaces() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/places", { cache: "no-store" });
      if (!response.ok) throw new Error("Place refresh failed");
      const data = (await response.json()) as { places?: Place[]; source?: "google_places" | "demo" };
      if (data.places?.length) setPlaces(data.places.slice(0, 6));
      setPlaceSource(data.source ?? "demo");
    } catch {
      setPlaces(fallbackPlaces);
      setPlaceSource("demo");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => { void refreshPlaces(); }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: unknown) => void } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool({
        name: "open_tripsync_group_plan",
        title: "Open group plan",
        description: "Navigate TripSync to the group preferences and conflict review screen.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async () => { setScreen("group"); return { screen: "group", conflictChoice }; },
      }, { signal: lifecycle.signal });
    } catch { /* WebMCP is optional. */ }
    return () => lifecycle.abort();
  }, [conflictChoice]);

  const currentQuestion = questions[questionIndex];
  const mustVisits = useMemo(() => places.filter((place) => placeChoices[place.id] === "must"), [places, placeChoices]);
  const setChoice = (placeId: string, value: "must" | "interested" | "skip") => setPlaceChoices((current) => ({ ...current, [placeId]: value }));
  const nextQuestion = () => questionIndex < questions.length ? setQuestionIndex((current) => current + 1) : setScreen("profile");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader screen={screen} onHome={() => setScreen("lobby")} />

      {screen === "lobby" && (
        <section className="mx-auto grid w-full max-w-6xl gap-7 px-4 pb-16 pt-6 sm:px-7 lg:grid-cols-[1.4fr_0.8fr] lg:pt-10">
          <Card className="overflow-hidden border-0 bg-[#132f42] text-white shadow-[0_22px_70px_rgba(19,47,66,.22)]">
            <div className="relative min-h-[500px]">
              <img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Shibuya_Crossing_in_Tokyo.jpg/960px-Shibuya_Crossing_in_Tokyo.jpg" alt="Night view of Shibuya Crossing in Tokyo" className="absolute inset-0 h-full w-full object-cover opacity-55" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102b3c] via-[#102b3c]/65 to-transparent" />
              <div className="relative flex min-h-[500px] flex-col justify-end p-6 sm:p-9">
                <div className="mb-auto flex items-center justify-between"><Badge className="border-white/20 bg-white/12 px-3 py-1 text-white backdrop-blur">TRIP · TOKYO</Badge><span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-sm backdrop-blur">May 20–24</span></div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffd0c5]">Japan graduation trip</p>
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">Build the trip everyone wants to take.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/78 sm:text-lg">Four travelers. One five-day plan. TripSync turns everyone’s preferences and limits into a fair itinerary.</p>
                <div className="mt-7 flex flex-wrap gap-3"><Button size="lg" className="h-12 rounded-full bg-[#f26a52] px-6 text-white hover:bg-[#db5843]" onClick={() => setScreen("quiz")}>Answer as Emma <ChevronRight className="ml-1 h-4 w-4" /></Button><Button size="lg" variant="outline" className="h-12 rounded-full border-white/30 bg-white/8 px-6 text-white hover:bg-white/16 hover:text-white" onClick={() => setScreen("group")}>Preview group plan</Button></div>
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            <Card className="border-[#dce4e7] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#dd5947]">GROUP LOBBY</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">3 of 4 ready</h2></div><Users className="h-6 w-6 text-[#315b7d]" /></div>
              <Progress value={75} className="mt-5 h-2 bg-[#e9eff1] [&>div]:bg-[#ef6a53]" />
              <div className="mt-5 space-y-3">
                {travelers.map((traveler) => (
                  <div key={traveler.name} className="flex items-center gap-3 rounded-2xl border border-[#e2e9eb] p-3">
                    <span className={`grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white ${traveler.color}`}>{traveler.initials}</span>
                    <div className="min-w-0 flex-1"><p className="font-medium">{traveler.name}</p><p className="text-sm text-muted-foreground">{traveler.status === "You" ? "Your quiz is waiting" : "Traveler profile ready"}</p></div>
                    {traveler.status === "Complete" ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e3f3ed] text-[#2d775f]"><Check className="h-4 w-4" /></span> : <Badge variant="outline" className="border-[#f2b5a9] text-[#c84b37]">You</Badge>}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="border-[#dce4e7] bg-[#f5f8f8] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#315b7d]"><span className="h-2 w-2 rounded-full bg-[#3c8f72]" /> PLACE DATA</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{placeSource === "google_places" ? "Live Google Places data connected" : "Demo dataset active · Google Places adapter ready"}</p></div><Button aria-label="Refresh place data" size="icon" variant="outline" className="rounded-full" onClick={refreshPlaces} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div></Card>
            <p className="px-2 text-xs leading-5 text-muted-foreground">Tokyo photo by Christophe95, licensed CC BY-SA 4.0 via Wikimedia Commons.</p>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-7 sm:pt-10">
          <div className="mb-8 flex items-center gap-4"><Button aria-label="Go back" variant="ghost" size="icon" className="rounded-full" onClick={() => questionIndex === 0 ? setScreen("lobby") : setQuestionIndex((value) => value - 1)}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><div className="mb-2 flex justify-between text-sm"><span className="font-medium">Emma’s travel style</span><span className="text-muted-foreground">{questionIndex + 1} of {questions.length + 1}</span></div><Progress value={((questionIndex + 1) / (questions.length + 1)) * 100} className="h-2 [&>div]:bg-[#ef6a53]" /></div></div>
          {questionIndex < questions.length ? (
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">{currentQuestion.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">{currentQuestion.title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{currentQuestion.help}</p>
              <RadioGroup value={answers[currentQuestion.key]} onValueChange={(value) => setAnswers((current) => ({ ...current, [currentQuestion.key]: value }))} className="mt-8 grid gap-3">
                {currentQuestion.options.map(([value, title, description]) => (
                  <Label key={value} htmlFor={`${currentQuestion.key}-${value}`} className={`group flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${answers[currentQuestion.key] === value ? "border-[#ef6a53] bg-[#fff4f0] shadow-[0_8px_30px_rgba(239,106,83,.10)]" : "border-[#dce4e7] bg-white hover:border-[#9eb1b8]"}`}><RadioGroupItem id={`${currentQuestion.key}-${value}`} value={value} className="mt-0.5 border-[#899aa0] text-[#e55e47]" /><span><span className="block text-base font-semibold">{title}</span><span className="mt-1 block text-sm font-normal leading-6 text-muted-foreground">{description}</span></span></Label>
                ))}
              </RadioGroup>
              <Button size="lg" className="mt-8 h-12 rounded-full bg-[#17384d] px-7 hover:bg-[#0f2c3f]" onClick={nextQuestion}>Continue</Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">TOKYO PICKS</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">What deserves a place in your Tokyo story?</h1><p className="mt-4 text-base leading-7 text-muted-foreground">Mark up to three must-visits. Live place details are used when an API key is connected.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {places.map((place) => (
                  <Card key={place.id} className="border-[#dce4e7] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{place.name}</p><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {place.area}</p></div>{place.rating && <Badge variant="secondary">★ {place.rating.toFixed(1)}</Badge>}</div>
                    <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[#f2f5f5] p-1">{(["must", "interested", "skip"] as const).map((choice) => <button key={choice} type="button" onClick={() => choice !== "must" || mustVisits.length < 3 || placeChoices[place.id] === "must" ? setChoice(place.id, choice) : undefined} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition ${placeChoices[place.id] === choice ? choice === "must" ? "bg-[#ef6a53] text-white" : "bg-white text-[#17384d] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{choice}</button>)}</div>
                  </Card>
                ))}
              </div>
              <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{mustVisits.length}/3 must-visits selected</p><Button size="lg" className="h-12 rounded-full bg-[#17384d] px-7 hover:bg-[#0f2c3f]" onClick={nextQuestion}>Create my profile</Button></div>
            </div>
          )}
        </section>
      )}

      {screen === "profile" && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-7 sm:pt-12"><div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <Card className="relative overflow-hidden border-0 bg-[#17384d] p-7 text-white shadow-[0_22px_70px_rgba(23,56,77,.2)] sm:p-10"><Sparkles className="absolute right-8 top-8 h-8 w-8 text-[#f5b6a9]" /><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f5b6a9]">Emma’s Travel DNA</p><h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">The Curious City Balancer</h1><p className="mt-5 max-w-xl text-base leading-7 text-white/75">You want iconic Tokyo moments without turning every day into a race. A thoughtful splurge, moderate walking, and time to notice the city suit you best.</p><div className="mt-9 flex flex-wrap gap-2">{Object.values(answers).map((answer) => <Badge key={answer} className="border-white/15 bg-white/10 px-3 py-1.5 text-white">{answerLabels[answer]}</Badge>)}</div></Card>
          <div className="space-y-5"><Card className="border-[#dce4e7] bg-white p-6"><p className="text-sm font-semibold text-[#d9513f]">YOUR MUST-VISITS</p><div className="mt-4 space-y-3">{(mustVisits.length ? mustVisits : places.slice(0, 2)).map((place, index) => <div key={place.id} className="flex items-center gap-3 rounded-2xl bg-[#f4f7f7] p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#17384d] text-sm font-semibold text-white">{index + 1}</span><div><p className="font-medium">{place.name}</p><p className="text-sm text-muted-foreground">{place.area}</p></div></div>)}</div></Card><Button size="lg" className="h-13 w-full rounded-full bg-[#ef6a53] text-white hover:bg-[#dc5944]" onClick={() => setScreen("group")}>Add my profile to the group</Button><button className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setQuestionIndex(0); setScreen("quiz"); }}>Edit my answers</button></div>
        </div></section>
      )}

      {screen === "group" && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-7 sm:pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">GROUP PROFILE</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Your group agrees on more than you think.</h1></div><div className="flex -space-x-2">{travelers.map((traveler) => <span key={traveler.name} title={traveler.name} className={`grid h-10 w-10 place-items-center rounded-full border-2 border-background text-xs font-semibold text-white ${traveler.color}`}>{traveler.initials}</span>)}</div></div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3"><MetricCard icon={<Heart className="h-5 w-5" />} label="Shared energy" value="Culture + food" note="Chosen by 4 of 4 travelers" /><MetricCard icon={<Footprints className="h-5 w-5" />} label="Shared pace" value="Moderate" note="Plan around an 8,000-step daily cap" /><MetricCard icon={<CircleDollarSign className="h-5 w-5" />} label="Comfort zone" value="$80–$140" note="One optional splurge is workable" /></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-[#dce4e7] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Everyone gets a moment</h2><Badge className="bg-[#e3f3ed] text-[#23664f]">4/4 covered</Badge></div><div className="mt-5 space-y-4">{[["Emma", mustVisits[0]?.name ?? "teamLab Borderless", "Art & immersive experiences"],["Alex", "Sensō-ji", "History & traditional Tokyo"],["Maya", "Shibuya Sky", "Shopping & city views"],["Jordan", "Tokyo National Museum", "Museums & low-cost culture"]].map(([name, place, note], index) => <div key={name} className="flex gap-3"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${travelers[index].color}`}>{travelers[index].initials}</span><div><p className="font-medium">{place}</p><p className="text-sm text-muted-foreground">{name} · {note}</p></div></div>)}</div></Card>
            <Card className="border-[#f0c7bd] bg-[#fff8f5] p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4d7cf] text-[#b64735]"><Utensils className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#b64735]">1 DECISION NEEDED</p><h2 className="mt-1 text-xl font-semibold">Special dinner vs. daily budget</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Alex wants a premium sushi dinner. Jordan’s $80 daily cap makes it difficult as a required group activity.</p></div></div><RadioGroup value={conflictChoice} onValueChange={setConflictChoice} className="mt-5 gap-3">{[["alternative", "Choose a lower-cost alternative", "Everyone stays together · budget protected"],["optional", "Make the dinner optional", "Alex can splurge · others get a nearby casual option"],["exception", "Allow one budget exception", "Everyone joins · Jordan’s cap is relaxed for one evening"]].map(([value, title, description]) => <Label key={value} htmlFor={`conflict-${value}`} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${conflictChoice === value ? "border-[#ef6a53] bg-white" : "border-[#eadbd6] bg-white/55"}`}><RadioGroupItem id={`conflict-${value}`} value={value} className="mt-0.5 text-[#e75f48]" /><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{description}</span></span></Label>)}</RadioGroup></Card>
          </div>
          <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-3xl bg-[#17384d] p-5 text-white sm:flex-row sm:p-6"><div><p className="font-semibold">Ready to generate your group draft.</p><p className="mt-1 text-sm text-white/65">Your choice will shape Day 4 before the final plan is generated.</p></div><Button size="lg" className="h-12 w-full rounded-full bg-[#ef6a53] px-7 hover:bg-[#dc5944] sm:w-auto" disabled={generating} onClick={generateItinerary}><Sparkles className="mr-2 h-4 w-4" /> {generating ? "Generating your trip…" : "Generate itinerary"}</Button></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">AI generation sends your preference choices to DeepSeek. Companion profiles are simulated. <a href="/data-use" target="_blank" rel="noopener noreferrer" className="underline">Data use & terms</a></p>
          {generating && <p role="status" className="mt-3 text-sm text-[#315b7d]">Building five days with lunch, dinner, and low-walking alternatives. This may take up to a minute.</p>}
          {generationError && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ec] p-4 text-sm text-[#b64735]">{generationError}</p>}
          <Button disabled={generating} variant="ghost" className="mt-3 rounded-full" onClick={() => { setGeneratedItinerary(undefined); setWalkingMode("standard"); setScreen("itinerary"); }}>Preview sample itinerary</Button>
        </section>
      )}

      {screen === "itinerary" && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-7 sm:pt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#2f7a61]"><span className="h-2 w-2 rounded-full bg-[#3f9d7b]" /> READY TO REVIEW</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Five days, four travelers, no one left out.</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{walkingMode === "reduced" ? "A gentler version with shorter visits, seated breaks, and ride-first transfers." : "Built around each traveler’s priority interests and your dinner decision. Review the walking pace below."}</p></div><Button variant="outline" className="rounded-full" onClick={() => setScreen("group")}><ArrowLeft className="mr-2 h-4 w-4" /> Review decisions</Button></div>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {walkingMode === "reduced" && <div role="status" className="rounded-2xl border border-[#b8d6cb] bg-[#eef7f2] p-4"><p className="flex items-center gap-2 font-semibold text-[#2f7a61]"><Footprints className="h-5 w-5" />Less-walking plan applied</p><p className="mt-2 text-sm leading-6 text-muted-foreground">All five days now include shorter browsing, more seated breaks, and ride-first transfers. Lunch, dinner, and your dinner decision stay in place. Actual steps depend on routes and venue layouts; taxis may add cost.</p></div>}
              <DailyItinerary conflictChoice={conflictChoice} budget={answers.budget} walkingMode={walkingMode} generated={generatedItinerary} />
            </div>
            <aside className="space-y-4"><Card className="border-[#dce4e7] bg-[#f4f7f7] p-5"><CloudSun className="h-6 w-6 text-[#315b7d]" /><h2 className="mt-4 font-semibold">Before you book</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Opening hours, prices, and availability can change. Verify current details before purchasing tickets or making reservations.</p></Card><Card className="border-[#dce4e7] bg-white p-5"><p className="text-sm font-semibold">{generatedItinerary ? "Generated with DeepSeek" : "Sample itinerary"}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Review each traveler’s priorities, daily costs, and unresolved conflicts before accepting. Coverage has not been independently scored.</p></Card><Button className="h-12 w-full rounded-full bg-[#ef6a53] text-white hover:bg-[#dc5944]">Accept this draft</Button><Button variant="outline" className="h-12 w-full rounded-full" aria-pressed={walkingMode === "reduced"} onClick={() => setWalkingMode((current) => current === "standard" ? "reduced" : "standard")}>{walkingMode === "reduced" ? "Restore original pace" : "Reduce walking"}</Button></aside>
          </div>
        </section>
      )}
    </main>
  );
}

function AppHeader({ screen, onHome }: { screen: Screen; onHome: () => void }) {
  return <header className="sticky top-0 z-20 border-b border-[#dce4e7] bg-background/92 backdrop-blur-xl"><div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-7"><button type="button" onClick={onHome} className="flex items-center gap-2.5" aria-label="TripSync home"><span className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#17384d] text-white"><MapPin className="h-5 w-5" /></span><span className="text-lg font-semibold tracking-[-0.03em]">TripSync</span></button><div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span className="font-medium text-foreground">Japan graduation trip</span><span>·</span><span>{screen === "lobby" ? "Lobby" : screen === "quiz" ? "Travel quiz" : screen === "profile" ? "Your profile" : screen === "group" ? "Group profile" : "Itinerary"}</span></div><Badge variant="outline" className="border-[#c9d7db] bg-white">Prototype</Badge></div></header>;
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <Card className="border-[#dce4e7] bg-white p-5"><div className="flex items-center gap-2 text-sm font-semibold text-[#315b7d]">{icon}{label}</div><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-sm text-muted-foreground">{note}</p></Card>;
}
