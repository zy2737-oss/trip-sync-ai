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
import { AttractionCard } from "@/components/attraction-card";
import { Input } from "@/components/ui/input";
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

type PlaceChoice = "must" | "interested" | "skip";
type Member = { id: string; name: string; initials: string; color: string };
type MemberResponse = { answers: Record<string, string>; placeChoices: Record<string, PlaceChoice>; completed: boolean; updatedAt: string };
type TripGroup = { code: string; name: string; createdAt: string };

const STORAGE_KEY = "tripsync.local.v1";
const memberColors = ["bg-[#de5b48]", "bg-[#315b7d]", "bg-[#7c5d91]", "bg-[#3e8068]", "bg-[#b07d2b]", "bg-[#4a6fa5]", "bg-[#8a5a44]", "bg-[#5b8a72]"];
const defaultAnswers: Record<string, string> = { pace: "balanced", walking: "moderate", budget: "mid", food: "mixed", together: "mostly" };
const defaultPlaceChoices: Record<string, PlaceChoice> = { sensoji: "interested", teamlab: "must", meiji: "interested", museum: "skip", shibuya: "must", tsukiji: "interested" };

function makeCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `TS-${suffix}`;
}
function makeId() { return Math.random().toString(36).slice(2, 10); }
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function mostCommon(values: string[], fallback: string) {
  if (!values.length) return fallback;
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
function mostRestrictive(values: string[], order: string[], fallback: string) {
  if (!values.length) return fallback;
  return order.find((option) => values.includes(option)) ?? fallback;
}

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
  const [answers, setAnswers] = useState<Record<string, string>>(defaultAnswers);
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);
  const [placeSource, setPlaceSource] = useState<"google_places" | "demo">("demo");
  const [refreshing, setRefreshing] = useState(false);
  const [placeChoices, setPlaceChoices] = useState<Record<string, PlaceChoice>>(defaultPlaceChoices);
  const [conflictChoice, setConflictChoice] = useState("optional");
  const [walkingMode, setWalkingMode] = useState<WalkingMode>("standard");
  const [generatedItinerary, setGeneratedItinerary] = useState<AIItinerary>();
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  // --- Local multiplayer (stored only in this browser) ---
  const [group, setGroup] = useState<TripGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [responses, setResponses] = useState<Record<string, MemberResponse>>({});
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("Japan graduation trip");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinNameInput, setJoinNameInput] = useState("");
  const [newMemberInput, setNewMemberInput] = useState("");
  const [lobbyError, setLobbyError] = useState("");

  const currentMember = members.find((m) => m.id === currentMemberId) ?? null;
  const completedMembers = members.filter((m) => responses[m.id]?.completed);
  const aggregatedAnswers = useMemo<Record<string, string>>(() => {
    const done = completedMembers.map((m) => responses[m.id]).filter(Boolean);
    if (!done.length) return answers;
    return {
      pace: mostCommon(done.map((r) => r.answers.pace), "balanced"),
      walking: mostRestrictive(done.map((r) => r.answers.walking), ["light", "moderate", "active"], "moderate"),
      budget: mostRestrictive(done.map((r) => r.answers.budget), ["value", "mid", "flex"], "mid"),
      food: mostCommon(done.map((r) => r.answers.food), "mixed"),
      together: mostCommon(done.map((r) => r.answers.together), "mostly"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, responses]);
  const hasBudgetConflict = useMemo(() => {
    const done = completedMembers.map((m) => responses[m.id]).filter(Boolean);
    const hasValue = done.some((r) => r.answers.budget === "value");
    const hasSplurge = done.some((r) => r.answers.budget === "flex" || r.answers.food === "destination");
    return hasValue && hasSplurge;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, responses]);

  // Load local data once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { group: TripGroup | null; members: Member[]; responses: Record<string, MemberResponse>; currentMemberId: string | null };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
        setGroup(data.group ?? null);
        setMembers(data.members ?? []);
        setResponses(data.responses ?? {});
        setCurrentMemberId(data.currentMemberId ?? null);
        const me = (data.members ?? []).find((m) => m.id === data.currentMemberId);
        const mine = me ? data.responses?.[me.id] : undefined;
        if (mine) { setAnswers({ ...defaultAnswers, ...mine.answers }); setPlaceChoices({ ...defaultPlaceChoices, ...mine.placeChoices }); }
      }
    } catch { /* ignore corrupted local data */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist local data
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ group, members, responses, currentMemberId })); } catch { /* storage full/blocked */ }
  }, [hydrated, group, members, responses, currentMemberId]);

  // Keep other open tabs of this browser in sync (local prototype only)
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const data = JSON.parse(event.newValue) as { group: TripGroup | null; members: Member[]; responses: Record<string, MemberResponse>; currentMemberId: string | null };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync state from another tab's localStorage write
        setGroup(data.group ?? null);
        setMembers(data.members ?? []);
        setResponses(data.responses ?? {});
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Save current member's draft automatically
  useEffect(() => {
    if (!hydrated || !currentMemberId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep per-member draft in sync while answering
    setResponses((prev) => {
      const existing = prev[currentMemberId];
      const next: MemberResponse = { answers, placeChoices, completed: existing?.completed ?? false, updatedAt: new Date().toISOString() };
      if (existing && JSON.stringify(existing.answers) === JSON.stringify(answers) && JSON.stringify(existing.placeChoices) === JSON.stringify(placeChoices)) return prev;
      return { ...prev, [currentMemberId]: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, placeChoices, currentMemberId, hydrated]);

  function switchToMember(member: Member) {
    setCurrentMemberId(member.id);
    const mine = responses[member.id];
    setAnswers(mine ? { ...defaultAnswers, ...mine.answers } : defaultAnswers);
    setPlaceChoices(mine ? { ...defaultPlaceChoices, ...mine.placeChoices } : defaultPlaceChoices);
    setQuestionIndex(0);
  }
  function addMember(name: string): Member | null {
    const trimmed = name.trim();
    if (!trimmed) { setLobbyError("Please enter a nickname."); return null; }
    if (members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) { setLobbyError("That nickname is already in this group. Switch to them from the member list, or pick another name."); return null; }
    const member: Member = { id: makeId(), name: trimmed, initials: initialsOf(trimmed), color: memberColors[members.length % memberColors.length] };
    setMembers((prev) => [...prev, member]);
    setLobbyError("");
    return member;
  }
  function handleCreateGroup() {
    const name = nicknameInput.trim();
    if (!name) { setLobbyError("Enter your nickname first, so teammates know who answered."); return; }
    const newGroup: TripGroup = { code: makeCode(), name: groupNameInput.trim() || "Our trip", createdAt: new Date().toISOString() };
    const member: Member = { id: makeId(), name, initials: initialsOf(name), color: memberColors[0] };
    setGroup(newGroup); setMembers([member]); setResponses({}); setCurrentMemberId(member.id);
    setAnswers(defaultAnswers); setPlaceChoices(defaultPlaceChoices); setNicknameInput(""); setLobbyError("");
  }
  function handleJoinGroup() {
    const code = joinCodeInput.trim().toUpperCase();
    const name = joinNameInput.trim();
    if (!code || !name) { setLobbyError("Enter both the invite code and your nickname."); return; }
    if (!group) { setLobbyError("No group found in this browser yet. Ask the creator to create it on this device first — cross-device join comes with the database version."); return; }
    if (group.code !== code) { setLobbyError(`Invite code not found. This browser's group code is ${group.code}.`); return; }
    const member = addMember(name);
    if (member) { setCurrentMemberId(member.id); setAnswers(defaultAnswers); setPlaceChoices(defaultPlaceChoices); setJoinNameInput(""); }
  }
  function handleAddTraveler() {
    const member = addMember(newMemberInput);
    if (member) { setCurrentMemberId(member.id); setAnswers(defaultAnswers); setPlaceChoices(defaultPlaceChoices); setNewMemberInput(""); setScreen("quiz"); setQuestionIndex(0); }
  }
  function markCurrentCompleteAndShow(target: Screen) {
    if (currentMemberId) {
      setResponses((prev) => ({ ...prev, [currentMemberId]: { answers, placeChoices, completed: true, updatedAt: new Date().toISOString() } }));
    }
    setScreen(target);
  }
  function resetLocalDemo() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setGroup(null); setMembers([]); setResponses({}); setCurrentMemberId(null); setAnswers(defaultAnswers); setPlaceChoices(defaultPlaceChoices); setScreen("lobby"); setLobbyError("");
  }

  async function generateItinerary() {
    setGenerating(true); setGenerationError("");
    try {
      const allMust = completedMembers.flatMap((m) => { const r = responses[m.id]; if (!r) return []; return places.filter((p) => r.placeChoices[p.id] === "must").map((p) => p.name); });
      const mustForRequest = [...new Set(allMust.length ? allMust : places.filter(place => placeChoices[place.id] === "must").map(place => place.name))];
      const response = await fetch("/api/itinerary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: aggregatedAnswers, mustVisits: mustForRequest, conflictChoice }),
      });
      const data = await response.json() as { itinerary?: AIItinerary; message?: string };
      if (!response.ok || !data.itinerary) throw new Error(data.message ?? "Could not generate this itinerary.");
      setGeneratedItinerary(data.itinerary); setWalkingMode(aggregatedAnswers.walking === "light" ? "reduced" : "standard"); setScreen("itinerary");
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
  const setChoice = (placeId: string, value: PlaceChoice) => setPlaceChoices((current) => ({ ...current, [placeId]: value }));
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
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffd0c5]">{group ? group.name : "Japan graduation trip"}</p>
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">Build the trip everyone wants to take.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/78 sm:text-lg">Everyone answers for themselves. TripSync combines real profiles into a fair itinerary — no account or API key needed for this local prototype.</p>
                {group && currentMember ? (
                  <div className="mt-7 flex flex-wrap items-center gap-3"><Button size="lg" className="h-12 rounded-full bg-[#f26a52] px-6 text-white hover:bg-[#db5843]" onClick={() => { setQuestionIndex(0); setScreen("quiz"); }}>Answer as {currentMember.name} <ChevronRight className="ml-1 h-4 w-4" /></Button><Button size="lg" variant="outline" className="h-12 rounded-full border-white/30 bg-white/8 px-6 text-white hover:bg-white/16 hover:text-white" onClick={() => setScreen("group")}>View group summary</Button><span className="rounded-full bg-white/15 px-3 py-1 text-sm">Invite code: <strong>{group.code}</strong></span></div>
                ) : (
                  <p className="mt-7 text-sm text-white/75">Create a group or join one on the right to start →</p>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-5">
            {!group ? (
              <Card className="border-[#dce4e7] bg-white p-5 shadow-sm sm:p-6">
                <p className="text-sm font-semibold text-[#dd5947]">START A GROUP</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Create or join</h2>
                <div className="mt-5 space-y-3">
                  <Label htmlFor="group-name">Trip name</Label>
                  <Input id="group-name" value={groupNameInput} onChange={(e) => setGroupNameInput(e.target.value)} placeholder="Japan graduation trip" />
                  <Label htmlFor="your-name">Your nickname</Label>
                  <Input id="your-name" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="e.g. Emma" />
                  <Button className="h-11 w-full rounded-full bg-[#17384d] hover:bg-[#0f2c3f]" onClick={handleCreateGroup}>Create group</Button>
                </div>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-[#e2e9eb]" />OR JOIN WITH A CODE<span className="h-px flex-1 bg-[#e2e9eb]" /></div>
                <div className="space-y-3">
                  <Label htmlFor="join-code">Invite code</Label>
                  <Input id="join-code" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="TS-XXXX" />
                  <Label htmlFor="join-name">Your nickname</Label>
                  <Input id="join-name" value={joinNameInput} onChange={(e) => setJoinNameInput(e.target.value)} placeholder="e.g. Alex" />
                  <Button variant="outline" className="h-11 w-full rounded-full" onClick={handleJoinGroup}>Join group</Button>
                </div>
                {lobbyError && <p role="alert" className="mt-4 rounded-xl bg-[#fff0ec] p-3 text-sm text-[#b64735]">{lobbyError}</p>}
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Local prototype: groups live only in this browser. On this device you can add several travelers and switch between them to demo the flow. Cross-device sync arrives with the database version.</p>
              </Card>
            ) : (
              <Card className="border-[#dce4e7] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#dd5947]">GROUP LOBBY · {group.code}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{members.length ? `${completedMembers.length} of ${members.length} ready` : "No travelers yet"}</h2></div><Users className="h-6 w-6 text-[#315b7d]" /></div>
                <Progress value={members.length ? (completedMembers.length / members.length) * 100 : 0} className="mt-5 h-2 bg-[#e9eff1] [&>div]:bg-[#ef6a53]" />
                <div className="mt-5 space-y-3">
                  {members.map((member) => {
                    const done = !!responses[member.id]?.completed;
                    const isYou = member.id === currentMemberId;
                    return (
                      <button key={member.id} type="button" onClick={() => switchToMember(member)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${isYou ? "border-[#ef6a53] bg-[#fff4f0]" : "border-[#e2e9eb] hover:border-[#9eb1b8]"}`}>
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span>
                        <span className="min-w-0 flex-1"><span className="block font-medium">{member.name}{isYou ? " (you)" : ""}</span><span className="block text-sm text-muted-foreground">{done ? "Profile ready — tap to edit" : "Quiz waiting — tap to answer as them"}</span></span>
                        {done ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e3f3ed] text-[#2d775f]"><Check className="h-4 w-4" /></span> : <Badge variant="outline" className="border-[#f2b5a9] text-[#c84b37]">Waiting</Badge>}
                      </button>
                    );
                  })}
                  {!members.length && <p className="text-sm text-muted-foreground">Add the first traveler below.</p>}
                </div>
                <div className="mt-5 space-y-3 border-t pt-5">
                  <Label htmlFor="new-member">Add another traveler (on this device)</Label>
                  <div className="flex gap-2"><Input id="new-member" value={newMemberInput} onChange={(e) => setNewMemberInput(e.target.value)} placeholder="Teammate nickname" onKeyDown={(e) => { if (e.key === "Enter") handleAddTraveler(); }} /><Button className="shrink-0 rounded-full bg-[#17384d] hover:bg-[#0f2c3f]" onClick={handleAddTraveler}>Add &amp; answer</Button></div>
                  {lobbyError && <p role="alert" className="rounded-xl bg-[#fff0ec] p-3 text-sm text-[#b64735]">{lobbyError}</p>}
                  <button type="button" className="text-xs text-muted-foreground underline underline-offset-4 hover:underline" onClick={resetLocalDemo}>Reset local demo data</button>
                </div>
              </Card>
            )}
            <Card className="border-[#dce4e7] bg-[#f5f8f8] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#315b7d]"><span className="h-2 w-2 rounded-full bg-[#3c8f72]" /> PLACE DATA</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{placeSource === "google_places" ? "Live Google Places data connected" : "Demo dataset active · Google Places adapter ready"}</p></div><Button aria-label="Refresh place data" size="icon" variant="outline" className="rounded-full" onClick={refreshPlaces} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div></Card>
            <p className="px-2 text-xs leading-5 text-muted-foreground">Tokyo photo by Christophe95, licensed CC BY-SA 4.0 via Wikimedia Commons.</p>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-7 sm:pt-10">
          <div className="mb-8 flex items-center gap-4"><Button aria-label="Go back" variant="ghost" size="icon" className="rounded-full" onClick={() => questionIndex === 0 ? setScreen("lobby") : setQuestionIndex((value) => value - 1)}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{currentMember ? `${currentMember.name}’s travel style` : "Your travel style"}</span><span className="text-muted-foreground">{questionIndex + 1} of {questions.length + 1}</span></div><Progress value={((questionIndex + 1) / (questions.length + 1)) * 100} className="h-2 [&>div]:bg-[#ef6a53]" /></div></div>
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
              <p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">TOKYO PICKS</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">What deserves a place in your Tokyo story?</h1><p className="mt-4 text-base leading-7 text-muted-foreground">Click a card for photos, highlights, and visit tips. Then mark up to three must-visits.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {places.map((place) => (
                  <AttractionCard key={place.id} place={place} choice={placeChoices[place.id]} canSelectMust={mustVisits.length < 3 || placeChoices[place.id] === "must"} onChoice={(choice) => setChoice(place.id, choice)} />
                ))}
              </div>
              <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{mustVisits.length}/3 must-visits selected</p><Button size="lg" className="h-12 rounded-full bg-[#17384d] px-7 hover:bg-[#0f2c3f]" onClick={nextQuestion}>Create my profile</Button></div>
            </div>
          )}
        </section>
      )}

      {screen === "profile" && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-7 sm:pt-12"><div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <Card className="relative overflow-hidden border-0 bg-[#17384d] p-7 text-white shadow-[0_22px_70px_rgba(23,56,77,.2)] sm:p-10"><Sparkles className="absolute right-8 top-8 h-8 w-8 text-[#f5b6a9]" /><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#f5b6a9]">{currentMember ? `${currentMember.name}’s Travel DNA` : "Your Travel DNA"}</p><h1 className="mt-5 max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">The Curious City Balancer</h1><p className="mt-5 max-w-xl text-base leading-7 text-white/75">You want iconic Tokyo moments without turning every day into a race. A thoughtful splurge, moderate walking, and time to notice the city suit you best.</p><div className="mt-9 flex flex-wrap gap-2">{Object.values(answers).map((answer) => <Badge key={answer} className="border-white/15 bg-white/10 px-3 py-1.5 text-white">{answerLabels[answer]}</Badge>)}</div></Card>
          <div className="space-y-5"><Card className="border-[#dce4e7] bg-white p-6"><p className="text-sm font-semibold text-[#d9513f]">YOUR MUST-VISITS</p><div className="mt-4 space-y-3">{(mustVisits.length ? mustVisits : places.slice(0, 2)).map((place, index) => <div key={place.id} className="flex items-center gap-3 rounded-2xl bg-[#f4f7f7] p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#17384d] text-sm font-semibold text-white">{index + 1}</span><div><p className="font-medium">{place.name}</p><p className="text-sm text-muted-foreground">{place.area}</p></div></div>)}</div></Card><Button size="lg" className="h-13 w-full rounded-full bg-[#ef6a53] text-white hover:bg-[#dc5944]" onClick={() => markCurrentCompleteAndShow("group")}>Save my profile to the group</Button><button className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => { setQuestionIndex(0); setScreen("quiz"); }}>Edit my answers</button></div>
        </div></section>
      )}

      {screen === "group" && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-7 sm:pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">GROUP PROFILE</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Your group agrees on more than you think.</h1></div><div className="flex -space-x-2">{members.map((member) => <span key={member.id} title={member.name} className={`grid h-10 w-10 place-items-center rounded-full border-2 border-background text-xs font-semibold text-white ${member.color}`}>{member.initials}</span>)}</div></div>
          <p className="mt-3 text-sm text-muted-foreground">{completedMembers.length} of {members.length} travelers have submitted. Summary below uses only submitted profiles{group ? ` · Group ${group.code}` : ""}.</p>
          <div className="mt-6 grid gap-5 lg:grid-cols-3"><MetricCard icon={<Heart className="h-5 w-5" />} label="Shared pace (majority)" value={answerLabels[aggregatedAnswers.pace] ?? aggregatedAnswers.pace} note={completedMembers.length ? `From ${completedMembers.length} submitted profile${completedMembers.length > 1 ? "s" : ""}` : "Waiting for answers"} /><MetricCard icon={<Footprints className="h-5 w-5" />} label="Walking limit (lowest wins)" value={answerLabels[aggregatedAnswers.walking] ?? aggregatedAnswers.walking} note="Plan around the most limited traveler" /><MetricCard icon={<CircleDollarSign className="h-5 w-5" />} label="Budget comfort (lowest wins)" value={answerLabels[aggregatedAnswers.budget] ?? aggregatedAnswers.budget} note="Protects the tightest budget" /></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-[#dce4e7] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Everyone gets a moment</h2><Badge className="bg-[#e3f3ed] text-[#23664f]">{completedMembers.length}/{members.length} covered</Badge></div><div className="mt-5 space-y-4">{completedMembers.length ? completedMembers.map((member) => { const r = responses[member.id]; const firstMust = r ? places.find((p) => r.placeChoices[p.id] === "must") : undefined; return <div key={member.id} className="flex gap-3"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span><div><p className="font-medium">{firstMust?.name ?? "No must-visit picked yet"}</p><p className="text-sm text-muted-foreground">{member.name} · {r ? (answerLabels[r.answers.food] ?? "") : ""}</p></div></div>; }) : <p className="text-sm text-muted-foreground">No profiles submitted yet. Go back to the lobby and answer as at least one traveler.</p>}</div></Card>
            {hasBudgetConflict ? (
            <Card className="border-[#f0c7bd] bg-[#fff8f5] p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4d7cf] text-[#b64735]"><Utensils className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#b64735]">1 DECISION NEEDED</p><h2 className="mt-1 text-xl font-semibold">Special dinner vs. daily budget</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Some travelers chose a tight daily budget while others want a splurge or food-led plan. Decide together how to handle the special dinner.</p></div></div><RadioGroup value={conflictChoice} onValueChange={setConflictChoice} className="mt-5 gap-3">{[["alternative", "Choose a lower-cost alternative", "Everyone stays together · budget protected"],["optional", "Make the dinner optional", "Those who want can splurge · others get a nearby casual option"],["exception", "Allow one budget exception", "Everyone joins · the tightest cap is relaxed for one evening"]].map(([value, title, description]) => <Label key={value} htmlFor={`conflict-${value}`} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${conflictChoice === value ? "border-[#ef6a53] bg-white" : "border-[#eadbd6] bg-white/55"}`}><RadioGroupItem id={`conflict-${value}`} value={value} className="mt-0.5 text-[#e75f48]" /><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{description}</span></span></Label>)}</RadioGroup></Card>
            ) : (
            <Card className="border-[#b8d6cb] bg-[#eef7f2] p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d7eadf] text-[#2d775f]"><Check className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#2d775f]">NO DECISION NEEDED</p><h2 className="mt-1 text-xl font-semibold">No budget conflict detected</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{completedMembers.length ? "Submitted budgets and food styles can work together. You can still preview the sample itinerary." : "Submit at least one profile to check for conflicts."}</p></div></div></Card>
            )}
          </div>
          <Card className="mt-6 border-[#dce4e7] bg-white p-6"><h2 className="text-xl font-semibold">What each person chose</h2><p className="mt-1 text-sm text-muted-foreground">If the summary above looks unchanged, check here first — majority and lowest-limit rules can hide a single change.</p><div className="mt-5 space-y-3">{completedMembers.length ? completedMembers.map((member) => { const r = responses[member.id]; if (!r) return null; return <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e2e9eb] p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span><span className="mr-1 font-medium">{member.name}</span>{Object.values(r.answers).map((value) => <Badge key={value} variant="secondary" className="px-2 py-1">{answerLabels[value] ?? value}</Badge>)}</div>; }) : <p className="text-sm text-muted-foreground">No submitted profiles yet.</p>}</div></Card>
          <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-3xl bg-[#17384d] p-5 text-white sm:flex-row sm:p-6"><div><p className="font-semibold">Ready to generate your group draft.</p><p className="mt-1 text-sm text-white/65">Your choice will shape Day 4 before the final plan is generated.</p></div><Button size="lg" className="h-12 w-full rounded-full bg-[#ef6a53] px-7 hover:bg-[#dc5944] sm:w-auto" disabled={generating} onClick={generateItinerary}><Sparkles className="mr-2 h-4 w-4" /> {generating ? "Generating your trip…" : "Generate itinerary"}</Button></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Local prototype: profiles are stored only in this browser. AI generation (when connected) sends the aggregated preferences to DeepSeek. <a href="/data-use" target="_blank" rel="noopener noreferrer" className="underline">Data use & terms</a></p>
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
              <DailyItinerary conflictChoice={conflictChoice} budget={aggregatedAnswers.budget} walkingMode={walkingMode} generated={generatedItinerary} />
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
