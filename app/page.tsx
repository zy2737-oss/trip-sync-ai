"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTripGroup } from "@/hooks/use-trip-group";
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
import { TravelStyleCard, GroupTravelStyles, StyleIcon } from "@/components/travel-style-card";
import { scoreTravelStyle, styleQuestions, styleAnswersSchema, styleIds, travelStyles, type StyleAnswers } from "@/lib/travel-personality";
import type { Profile } from "@/lib/group-contract";
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
  checkedAt?: string | null;
};

type PlaceChoice = "must" | "interested" | "skip";
const memberColors = ["bg-[#de5b48]", "bg-[#315b7d]", "bg-[#7c5d91]", "bg-[#3e8068]", "bg-[#b07d2b]", "bg-[#4a6fa5]"];
const defaultAnswers: Record<string, string> = { pace: "balanced", walking: "moderate", budget: "mid", food: "mixed", together: "mostly" };
const defaultPlaceChoices: Record<string, PlaceChoice> = { sensoji: "interested", teamlab: "interested", meiji: "interested", museum: "interested", shibuya: "interested", tsukiji: "interested" };

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
  { id: "sensoji", name: "Sensō-ji", area: "Asakusa", rating: 4.5, priceLevel: "Free", status: "Unverified", source: "demo" },
  { id: "teamlab", name: "teamLab Borderless", area: "Azabudai Hills", rating: 4.6, priceLevel: "$$", status: "Unverified", source: "demo" },
  { id: "meiji", name: "Meiji Jingu", area: "Harajuku", rating: 4.6, priceLevel: "Free", status: "Unverified", source: "demo" },
  { id: "museum", name: "Tokyo National Museum", area: "Ueno", rating: 4.5, priceLevel: "$", status: "Unverified", source: "demo" },
  { id: "shibuya", name: "Shibuya Sky", area: "Shibuya", rating: 4.6, priceLevel: "$$", status: "Unverified", source: "demo" },
  { id: "tsukiji", name: "Tsukiji Outer Market", area: "Tsukiji", rating: 4.2, priceLevel: "$", status: "Unverified", source: "demo" },
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
  useEffect(()=>{window.scrollTo(0,0);},[screen]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [styleAnswers, setStyleAnswers] = useState<Partial<StyleAnswers>>({});
  const [topPick, setTopPick] = useState<Profile["topPick"]>();
  const [shareStyle, setShareStyle] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(defaultAnswers);
  const [places, setPlaces] = useState<Place[]>(fallbackPlaces);
  const [placeSource, setPlaceSource] = useState<"google_places" | "demo">("demo");
  const [refreshing, setRefreshing] = useState(false);
  const [placeChoices, setPlaceChoices] = useState<Record<string, PlaceChoice>>(defaultPlaceChoices);
  const [conflictChoice, setConflictChoice] = useState("alternative");
  const [walkingMode, setWalkingMode] = useState<WalkingMode>("standard");
  const [generatedItinerary, setGeneratedItinerary] = useState<AIItinerary>();
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const shared = useTripGroup();
  const group = shared.snapshot?.group ?? null;
  const responses = shared.snapshot?.responses ?? {};
  const members = (shared.snapshot?.members ?? []).map((m,i) => ({...m, initials:m.name.slice(0,2).toUpperCase(),color:memberColors[i%memberColors.length]}));
  const currentMemberId = shared.snapshot?.currentMemberId ?? null;
  const currentMember = members.find(m=>m.id===currentMemberId) ?? null;
  const isOrganizer = currentMember?.role === "organizer";
  const completedMembers = members.filter(m=>m.completed);
  const [nicknameInput,setNicknameInput]=useState("");
  const [groupNameInput,setGroupNameInput]=useState("Japan graduation trip");
  const [joinCodeInput,setJoinCodeInput]=useState("");
  const [joinNameInput,setJoinNameInput]=useState("");
  const [copyMessage,setCopyMessage]=useState("");
  const [inviteUrl,setInviteUrl]=useState("");
  const loadedMember=useRef<string|null>(null);
  const loadedPlan=useRef<string>("");
  useEffect(()=>{if(shared.invite)setJoinCodeInput(shared.invite);},[shared.invite]);
  useEffect(()=>{
    if(!shared.snapshot)return;
    if(loadedMember.current!==shared.snapshot.currentMemberId){
      const own=shared.snapshot.responses[shared.snapshot.currentMemberId];
      setAnswers(own?{...defaultAnswers,...own.answers}:defaultAnswers);
      setPlaceChoices(own?{...defaultPlaceChoices,...own.placeChoices}:defaultPlaceChoices);
      setStyleAnswers(own?.styleAnswers ?? {});setTopPick(own?.topPick);setShareStyle(own?.shareStyle ?? false);
      loadedMember.current=shared.snapshot.currentMemberId;
    }
    setGeneratedItinerary(shared.snapshot.itinerary);
    const planKey=`${shared.snapshot.group.code}:${shared.snapshot.planRevision}:${shared.snapshot.conflictChoice}`;
    if(loadedPlan.current!==planKey){setConflictChoice(shared.snapshot.conflictChoice);loadedPlan.current=planKey;}
    setInviteUrl(shared.invitation());
  },[shared.snapshot]);
  const planStale=!!shared.snapshot?.itinerary && shared.snapshot.planRevision!==group?.revision;
  async function copyLink(privateLink=false){
    try{await navigator.clipboard.writeText(privateLink?shared.recovery():shared.invitation());setCopyMessage(privateLink?"Private recovery link copied. Keep it secret — it grants your access.":"Invitation copied. Send it to your friends.");}
    catch{setCopyMessage("Clipboard unavailable. Select and copy the invitation below.");}
  }
  function leaveGroup(){if(window.confirm("Leave this device session? Copy your private recovery link first if you want to return.")){shared.leave();loadedMember.current=null;setScreen("lobby");setInviteUrl("");setGeneratedItinerary(undefined);}}
  async function removeGroup(){if(window.confirm("Delete this group, all profiles and its saved itinerary for everyone? This cannot be undone.")){if(await shared.remove()){loadedMember.current=null;setScreen("lobby");setInviteUrl("");setGeneratedItinerary(undefined);}}}
  async function handleCreateGroup(){await shared.enter("create",groupNameInput.trim()||"Our trip",nicknameInput);}
  async function handleJoinGroup(){await shared.enter("join",joinCodeInput.trim().toUpperCase(),joinNameInput);}
  async function markCurrentCompleteAndShow(target:Screen){
    const parsed=styleAnswersSchema.safeParse(styleAnswers);
    if(!parsed.success || !topPick){shared.setError("Complete the six style questions and choose your #1 attraction before submitting.");return;}
    const saved=await shared.save({answers:answers as Profile["answers"],placeChoices,completed:true,styleAnswers:parsed.data,topPick,shareStyle});
    if(saved)setScreen(target);
  }

  const aggregatedAnswers = useMemo<Record<string, string>>(() => {
    const done = completedMembers.map((m) => responses[m.id]).filter(Boolean);
    if (!done.length) return answers;
    return {
      pace: mostCommon(done.map((r) => r.answers.pace), "balanced"),
      walking: mostRestrictive(done.map((r) => r.answers.walking), ["light", "moderate", "active"], "moderate"),
      budget: mostRestrictive(done.map((r) => r.answers.budget), ["value", "mid", "flex"], "mid"),
      food: mostCommon(done.map((r) => r.answers.food), "mixed"),
      together: mostRestrictive(done.map((r) => r.answers.together), ["together", "mostly", "flexible"], "mostly"),
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

  async function generateItinerary() {
    if(!group)return;
    setGenerating(true);setGenerationError("");
    try {
      const saved=await shared.update("itinerary",{conflictChoice,expectedRevision:group.revision});
      if(saved?.itinerary){setGeneratedItinerary(saved.itinerary);setWalkingMode(aggregatedAnswers.walking==="light"?"reduced":"standard");setScreen("itinerary");}
    } finally {setGenerating(false);}
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

  const personalityCount = styleQuestions.length;
  const questionCount = personalityCount + questions.length;
  const isStyleQuestion = questionIndex < personalityCount;
  const currentQuestion = isStyleQuestion ? styleQuestions[questionIndex] : questions[questionIndex-personalityCount];
  const questionValue = currentQuestion ? (isStyleQuestion ? styleAnswers[currentQuestion.key as keyof StyleAnswers] : answers[currentQuestion.key]) : undefined;
  const personality = scoreTravelStyle(styleAnswers);
  const groupStyleEntries = members.flatMap(member=>{
    const result=isOrganizer?scoreTravelStyle(responses[member.id]?.styleAnswers):member.sharedStyle;
    return member.completed && result ? [{id:member.id,name:member.name,result}] : [];
  });
  const mustVisits = useMemo(() => places.filter((place) => placeChoices[place.id] === "must"), [places, placeChoices]);
  const setChoice = (placeId: string, value: PlaceChoice) => {setPlaceChoices((current) => ({ ...current, [placeId]: value }));if(placeId===topPick && value!=="must")setTopPick(undefined);};
  const chooseTopPick = (placeId: string) => {if(mustVisits.length>=3 && placeChoices[placeId]!=="must")return;setChoice(placeId,"must");setTopPick(placeId as Profile["topPick"]);};
  const answerQuestion = (value:string) => {if(isStyleQuestion)setStyleAnswers(current=>({...current,[currentQuestion.key]:value}));else setAnswers(current=>({...current,[currentQuestion.key]:value}));};
  const nextQuestion = () => questionIndex < questionCount ? setQuestionIndex((current) => current + 1) : setScreen("profile");
  useEffect(()=>{if(screen==="quiz")window.scrollTo(0,0);},[questionIndex,screen]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader screen={screen} onHome={() => setScreen("lobby")} />
      {shared.error && <div role="alert" className="mx-auto mt-4 max-w-5xl rounded-xl bg-[#fff0ec] p-4 text-sm text-[#b64735]">{shared.error} <button className="ml-3 underline" onClick={()=>shared.refresh()}>Retry</button>{!group && shared.session && <button className="ml-3 underline" onClick={()=>shared.leave()}>Forget this device session</button>}</div>}
      {shared.hydrated && shared.session && !group && <p role="status" className="mx-auto max-w-5xl p-4">Connecting to your saved group…</p>}

      {screen === "lobby" && (
        <section className="mx-auto grid w-full max-w-6xl gap-7 px-4 pb-16 pt-6 sm:px-7 lg:grid-cols-[1.4fr_0.8fr] lg:pt-10">
          <Card className="overflow-hidden border-0 bg-[#132f42] text-white shadow-[0_22px_70px_rgba(19,47,66,.22)]">
            <div className="relative min-h-[500px]">
              <img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Shibuya_Crossing_in_Tokyo.jpg/960px-Shibuya_Crossing_in_Tokyo.jpg" alt="Night view of Shibuya Crossing in Tokyo" className="absolute inset-0 h-full w-full object-cover opacity-55" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102b3c] via-[#102b3c]/65 to-transparent" />
              <div className="relative flex min-h-[500px] flex-col justify-end p-6 sm:p-9">
                <div className="mb-auto flex items-center justify-between"><Badge className="border-white/20 bg-white/12 px-3 py-1 text-white backdrop-blur">TRIP · TOKYO</Badge><span className="rounded-full border border-white/20 bg-black/15 px-3 py-1 text-sm backdrop-blur">5-day prototype</span></div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#ffd0c5]">{group ? group.name : "Japan graduation trip"}</p>
                <h1 className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">Build the trip everyone wants to take.</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-white/78 sm:text-lg">Discover your travel style, keep your practical limits clear, and build one shared Tokyo plan. Each friend joins from their own device. No registration needed.</p>
                <p className="mt-4 text-sm text-[#ffd0c5]">6 playful style picks + 5 practical questions + your Tokyo favorites.</p>
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
                  <Button className="h-11 w-full rounded-full bg-[#17384d] hover:bg-[#0f2c3f]" disabled={shared.busy || !shared.hydrated || !!shared.session} onClick={handleCreateGroup}>Create group</Button>
                </div>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-[#e2e9eb]" />OR JOIN WITH A CODE<span className="h-px flex-1 bg-[#e2e9eb]" /></div>
                <div className="space-y-3">
                  <Label htmlFor="join-code">Invite code</Label>
                  <Input id="join-code" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="Paste the invite code or open your invitation" />
                  <Label htmlFor="join-name">Your nickname</Label>
                  <Input id="join-name" value={joinNameInput} onChange={(e) => setJoinNameInput(e.target.value)} placeholder="e.g. Alex" />
                  <Button variant="outline" className="h-11 w-full rounded-full" disabled={shared.busy || !shared.hydrated || !!shared.session} onClick={handleJoinGroup}>Join group</Button>
                </div>

                <p className="mt-4 text-xs leading-5 text-muted-foreground">Profiles are stored in shared cloud storage. Submitted preferences are visible to the organizer. Keep invitations within your group. This browser remembers your private access credential; clearing storage removes access unless you saved your private recovery link.</p>
              </Card>
            ) : (
              <Card className="border-[#dce4e7] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#dd5947]">GROUP LOBBY · {group.code}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{members.length ? `${completedMembers.length} of ${members.length} ready` : "No travelers yet"}</h2></div><Users className="h-6 w-6 text-[#315b7d]" /></div>
                <Progress value={members.length ? (completedMembers.length / members.length) * 100 : 0} className="mt-5 h-2 bg-[#e9eff1] [&>div]:bg-[#ef6a53]" />
                <div className="mt-5 space-y-3">
                  {members.map((member) => {
                    const done = member.completed;
                    const isYou = member.id === currentMemberId;
                    return (
                      <button key={member.id} type="button" disabled={!isYou} onClick={() => {setQuestionIndex(0);setScreen("quiz");}} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${isYou ? "border-[#ef6a53] bg-[#fff4f0]" : "border-[#e2e9eb] hover:border-[#9eb1b8]"}`}>
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span>
                        <span className="min-w-0 flex-1"><span className="block font-medium">{member.name}{isYou ? " (you)" : ""}</span><span className="block text-sm text-muted-foreground">{done ? (isYou ? "Submitted — tap to edit yours" : "Profile submitted") : (isYou ? "Tap to fill in your questionnaire" : "Waiting for their submission")}</span></span>
                        {done ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e3f3ed] text-[#2d775f]"><Check className="h-4 w-4" /></span> : <Badge variant="outline" className="border-[#f2b5a9] text-[#c84b37]">Waiting</Badge>}
                      </button>
                    );
                  })}
                  {!members.length && <p className="text-sm text-muted-foreground">Add the first traveler below.</p>}
                </div>
                <div className="mt-5 space-y-3 border-t pt-5">
                  <Label htmlFor="invitation-link">Invite friends on their own devices</Label>
                  <Input id="invitation-link" readOnly value={inviteUrl} onFocus={e=>e.target.select()} />
                  <Button disabled={shared.busy} className="w-full rounded-full bg-[#17384d]" onClick={()=>copyLink()}>Copy invitation link</Button>
                  <Button variant="outline" className="w-full rounded-full" onClick={()=>copyLink(true)}>Copy my private recovery link</Button>
                  {copyMessage && <p role="status" className="text-sm text-[#315b7d]">{copyMessage}</p>}
                  <p className="text-xs leading-5 text-muted-foreground">Only you can edit your answers. {isOrganizer?"You organize this trip and can generate its plan.":"The organizer reviews submitted preferences and generates the plan."} Progress refreshes every 8 seconds.</p>
                  <Button variant="outline" className="w-full rounded-full" onClick={()=>shared.refresh()}>Refresh group</Button>
                  {shared.snapshot?.itinerary && <Button className="w-full rounded-full bg-[#17384d]" onClick={()=>setScreen("itinerary")}>View shared itinerary</Button>}
                  <button type="button" disabled={shared.busy} className="text-xs text-muted-foreground underline" onClick={leaveGroup}>Leave this device session</button>
                  {isOrganizer && <button type="button" disabled={shared.busy} className="ml-4 text-xs text-[#b64735] underline" onClick={removeGroup}>Delete group &amp; saved data</button>}
                </div>
              </Card>
            )}
            <Card className="border-[#dce4e7] bg-white p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d9513f]">What is your travel style?</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Six lighthearted styles. Your budget and walking needs stay separate.</p><div className="mt-4 grid grid-cols-2 gap-3">{styleIds.map(id=><div key={id} className="flex items-center gap-2 text-xs font-medium"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{background:travelStyles[id].softColor,color:travelStyles[id].color}}><StyleIcon id={id} className="h-4 w-4" /></span>{travelStyles[id].shortName}</div>)}</div></Card>
            <Card className="border-[#dce4e7] bg-[#f5f8f8] p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#315b7d]"><span className="h-2 w-2 rounded-full bg-[#3c8f72]" /> PLACE DATA</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{placeSource === "google_places" ? "Matching cards refreshed from Google Places; other cards use demo references" : "Demo dataset active · Google Places adapter ready"}</p></div><Button aria-label="Refresh place data" size="icon" variant="outline" className="rounded-full" onClick={refreshPlaces} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div></Card>
            <p className="px-2 text-xs leading-5 text-muted-foreground">Tokyo photo by Christophe95, licensed CC BY-SA 4.0 via Wikimedia Commons.</p>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-7 sm:pt-10">
          <div className="mb-8 flex items-center gap-4"><Button aria-label="Go back" variant="ghost" size="icon" className="rounded-full" onClick={() => questionIndex === 0 ? setScreen("lobby") : setQuestionIndex((value) => value - 1)}><ArrowLeft className="h-5 w-5" /></Button><div className="flex-1"><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{currentMember ? `${currentMember.name}’s travel style` : "Your travel style"}</span><span className="text-muted-foreground">{questionIndex + 1} of {questionCount + 1}</span></div><Progress value={((questionIndex + 1) / (questionCount + 1)) * 100} className="h-2 [&>div]:bg-[#ef6a53]" /></div></div>
          {questionIndex < questionCount ? (
            <div>
              <p className="mb-3 text-xs font-medium text-muted-foreground">{isStyleQuestion ? `PART 1 · YOUR TRAVEL STYLE · ${questionIndex+1}/6` : `PART 2 · PRACTICAL PLANNING · ${questionIndex-personalityCount+1}/5`}</p>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">{currentQuestion.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">{currentQuestion.title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{currentQuestion.help}</p>
              <RadioGroup value={questionValue ?? ""} onValueChange={answerQuestion} className="mt-8 grid gap-3">
                {currentQuestion.options.map(([value, title, description]) => (
                  <Label key={value} htmlFor={`${currentQuestion.key}-${value}`} className={`group flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${questionValue === value ? "border-[#ef6a53] bg-[#fff4f0] shadow-[0_8px_30px_rgba(239,106,83,.10)]" : "border-[#dce4e7] bg-white hover:border-[#9eb1b8]"}`}><RadioGroupItem id={`${currentQuestion.key}-${value}`} value={value} className="mt-0.5 border-[#899aa0] text-[#e55e47]" /><span><span className="block text-base font-semibold">{title}</span><span className="mt-1 block text-sm font-normal leading-6 text-muted-foreground">{description}</span></span></Label>
                ))}
              </RadioGroup>
              <Button size="lg" className="mt-8 h-12 rounded-full bg-[#17384d] px-7 hover:bg-[#0f2c3f]" disabled={!questionValue} onClick={nextQuestion}>Continue</Button>
              {isStyleQuestion && <p className="mt-4 text-xs leading-5 text-muted-foreground">Just for this trip. These picks do not change your budget, walking limit or practical answers.</p>}
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">TOKYO PICKS</p><h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">What deserves a place in your Tokyo story?</h1><p className="mt-4 text-base leading-7 text-muted-foreground">Choose one #1 attraction, then up to two other must-visits. Open any card for photos and visit tips. Your first choice is a priority, not a guaranteed booking.</p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {places.map((place) => (
                  <AttractionCard key={place.id} place={place} choice={placeChoices[place.id]} canSelectMust={mustVisits.length < 3 || placeChoices[place.id] === "must"} onChoice={(choice) => setChoice(place.id, choice)} isTopPick={topPick===place.id} onTopPick={()=>chooseTopPick(place.id)} access={shared.session??undefined} />
                ))}
              </div>
              <div className="mt-7 flex items-center justify-between gap-4"><p className="text-sm text-muted-foreground">{mustVisits.length}/3 must-visits · {topPick ? "#1 selected" : "Choose your #1 to continue"}</p><Button disabled={!topPick || !personality} size="lg" className="h-12 rounded-full bg-[#17384d] px-7 hover:bg-[#0f2c3f]" onClick={nextQuestion}>Create my profile</Button></div>
            </div>
          )}
        </section>
      )}

      {screen === "profile" && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-7 sm:pt-12"><div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
          <TravelStyleCard result={personality} name={currentMember?.name} />
          <div className="space-y-5">
            <Card className="border-[#dce4e7] bg-white p-6"><p className="text-sm font-semibold text-[#d9513f]">YOUR PLANNING ANSWERS</p><p className="mt-2 text-sm leading-6 text-muted-foreground">These explicit choices take priority over your style card.</p><div className="mt-4 flex flex-wrap gap-2">{Object.values(answers).map(answer=><Badge key={answer} variant="secondary" className="px-3 py-1.5">{answerLabels[answer]}</Badge>)}</div></Card>
            <Card className="border-[#dce4e7] bg-white p-6"><p className="text-sm font-semibold text-[#d9513f]">YOUR TOKYO PRIORITIES</p><div className="mt-4 space-y-3">{[...mustVisits].sort((a,b)=>Number(b.id===topPick)-Number(a.id===topPick)).map(place=><div key={place.id} className={`flex items-center gap-3 rounded-2xl p-3 ${place.id===topPick?"bg-[#fff5dc]":"bg-[#f4f7f7]"}`}><span className="text-xs font-semibold text-[#805519]">{place.id===topPick?"#1":"Also"}</span><div><p className="font-medium">{place.name}</p><p className="text-sm text-muted-foreground">{place.area}</p></div></div>)}</div></Card>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dce4e7] bg-white p-4"><input type="checkbox" checked={shareStyle} onChange={e=>setShareStyle(e.target.checked)} className="mt-1 h-4 w-4 accent-[#d9513f]" /><span><span className="block text-sm font-semibold">Share my style card with this group</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Optional. Only your style label is shared with fellow members. Your detailed answers remain visible only to you and the organizer.</span></span></label>
            <Button size="lg" className="h-13 w-full rounded-full bg-[#ef6a53] text-white hover:bg-[#dc5944]" disabled={shared.busy || !personality || !topPick} onClick={()=>markCurrentCompleteAndShow("group")}>{shared.busy?"Saving…":"Submit my profile to the group"}</Button>
            <button className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={()=>{setQuestionIndex(0);setScreen("quiz");}}>Edit my answers</button>
          </div>
        </div></section>
      )}

      {screen === "group" && !isOrganizer && (
        <section className="mx-auto max-w-3xl space-y-5 px-5 py-10"><h1 className="text-3xl font-semibold">Your group, on everyone’s device</h1><p>{currentMember?.completed?"Your profile is submitted.":"Submit your profile so the organizer can include you."} {completedMembers.length} of {members.length} travelers are ready.</p><p className="text-muted-foreground">Only the organizer sees everyone’s detailed preferences and generates the itinerary. Your answers stay editable on this device.</p><TravelStyleCard result={scoreTravelStyle(responses[currentMemberId??""]?.styleAnswers)} name={currentMember?.name} /><GroupTravelStyles entries={groupStyleEntries} /><Button onClick={()=>{setQuestionIndex(0);setScreen("quiz");}}>Edit my answers</Button><Button variant="outline" className="ml-3" onClick={()=>setScreen("lobby")}>Group lobby</Button>{shared.snapshot?.itinerary && <Button className="ml-3" onClick={()=>setScreen("itinerary")}>View shared itinerary</Button>}</section>
      )}
      {screen === "group" && isOrganizer && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-7 sm:pt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold tracking-[0.16em] text-[#d9513f]">GROUP PROFILE</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Your group agrees on more than you think.</h1></div><div className="flex -space-x-2">{members.map((member) => <span key={member.id} title={member.name} className={`grid h-10 w-10 place-items-center rounded-full border-2 border-background text-xs font-semibold text-white ${member.color}`}>{member.initials}</span>)}</div></div>
          <p className="mt-3 text-sm text-muted-foreground">{completedMembers.length} of {members.length} travelers have submitted. Summary below uses only submitted profiles{group ? ` · Group ${group.code}` : ""}.</p>
          <div className="mt-6"><GroupTravelStyles entries={groupStyleEntries} privateView /></div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3"><MetricCard icon={<Heart className="h-5 w-5" />} label="Shared pace (majority)" value={answerLabels[aggregatedAnswers.pace] ?? aggregatedAnswers.pace} note={completedMembers.length ? `From ${completedMembers.length} submitted profile${completedMembers.length > 1 ? "s" : ""}` : "Waiting for answers"} /><MetricCard icon={<Footprints className="h-5 w-5" />} label="Walking limit (lowest wins)" value={answerLabels[aggregatedAnswers.walking] ?? aggregatedAnswers.walking} note="Plan around the most limited traveler" /><MetricCard icon={<CircleDollarSign className="h-5 w-5" />} label="Budget comfort (lowest wins)" value={answerLabels[aggregatedAnswers.budget] ?? aggregatedAnswers.budget} note="Protects the tightest budget" /></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-[#dce4e7] bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Everyone gets a moment</h2><Badge className="bg-[#e3f3ed] text-[#23664f]">{completedMembers.length}/{members.length} submitted</Badge></div><div className="mt-5 space-y-4">{completedMembers.length ? completedMembers.map((member) => { const r = responses[member.id]; const firstMust = r ? places.find(p=>p.id===r.topPick) ?? places.find((p) => r.placeChoices[p.id as keyof typeof r.placeChoices] === "must") : undefined; return <div key={member.id} className="flex gap-3"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span><div><p className="font-medium">{r?.topPick ? "#1 · " : ""}{firstMust?.name ?? "No must-visit picked yet"}</p><p className="text-sm text-muted-foreground">{member.name} · {r ? (answerLabels[r.answers.food] ?? "") : ""}</p></div></div>; }) : <p className="text-sm text-muted-foreground">No profiles submitted yet. Go back to the lobby and answer as at least one traveler.</p>}</div></Card>
            {hasBudgetConflict ? (
            <Card className="border-[#f0c7bd] bg-[#fff8f5] p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4d7cf] text-[#b64735]"><Utensils className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#b64735]">1 DECISION NEEDED</p><h2 className="mt-1 text-xl font-semibold">Special dinner vs. daily budget</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Some travelers chose a tight daily budget while others want a splurge or food-led plan. Decide together how to handle the special dinner.</p></div></div><RadioGroup disabled={shared.busy} value={conflictChoice} onValueChange={setConflictChoice} className="mt-5 gap-3">{[["alternative", "Choose a lower-cost alternative", "Everyone stays together · budget protected"],["optional", "Make the dinner optional", "Those who want can splurge · others get a nearby casual option"],["exception", "Allow one budget exception", "Everyone joins · the tightest cap is relaxed for one evening"]].map(([value, title, description]) => <Label key={value} htmlFor={`conflict-${value}`} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${conflictChoice === value ? "border-[#ef6a53] bg-white" : "border-[#eadbd6] bg-white/55"}`}><RadioGroupItem id={`conflict-${value}`} value={value} className="mt-0.5 text-[#e75f48]" /><span><span className="block font-semibold">{title}</span><span className="mt-1 block text-sm font-normal text-muted-foreground">{description}</span></span></Label>)}</RadioGroup></Card>
            ) : (
            <Card className="border-[#b8d6cb] bg-[#eef7f2] p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d7eadf] text-[#2d775f]"><Check className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[#2d775f]">NO DECISION NEEDED</p><h2 className="mt-1 text-xl font-semibold">No budget conflict detected</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{completedMembers.length ? "Submitted budgets and food styles can work together. You can still preview the sample itinerary." : "Submit at least one profile to check for conflicts."}</p></div></div></Card>
            )}
          </div>
          <Card className="mt-6 border-[#dce4e7] bg-white p-6"><h2 className="text-xl font-semibold">What each person chose</h2><p className="mt-1 text-sm text-muted-foreground">If the summary above looks unchanged, check here first — majority and lowest-limit rules can hide a single change.</p><div className="mt-5 space-y-3">{completedMembers.length ? completedMembers.map((member) => { const r = responses[member.id]; if (!r) return null; return <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e2e9eb] p-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${member.color}`}>{member.initials}</span><span className="mr-1 font-medium">{member.name}</span>{Object.values(r.answers).map((value) => <Badge key={value} variant="secondary" className="px-2 py-1">{answerLabels[value] ?? value}</Badge>)}</div>; }) : <p className="text-sm text-muted-foreground">No submitted profiles yet.</p>}</div></Card>
          <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-3xl bg-[#17384d] p-5 text-white sm:flex-row sm:p-6"><div><p className="font-semibold">Ready to generate your group draft.</p><p className="mt-1 text-sm text-white/65">Your choice will shape Day 4 before the final plan is generated.</p></div><Button size="lg" className="h-12 w-full rounded-full bg-[#ef6a53] px-7 hover:bg-[#dc5944] sm:w-auto" disabled={shared.busy || generating || !members.length || completedMembers.length !== members.length} onClick={generateItinerary}><Sparkles className="mr-2 h-4 w-4" /> {generating ? "Generating your trip…" : "Generate itinerary"}</Button></div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Shared profiles are saved in cloud storage. Generate is available when all joined travelers have submitted. DeepSeek receives preferences labeled Traveler 1, Traveler 2, etc., not your nicknames. <a href="/data-use" target="_blank" rel="noopener noreferrer" className="underline">Data use & terms</a></p>
          {generating && <p role="status" className="mt-3 text-sm text-[#315b7d]">Building five days with lunch, dinner, and low-walking alternatives. This may take up to a minute.</p>}
          {generationError && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ec] p-4 text-sm text-[#b64735]">{generationError}</p>}
          <Button disabled={generating} variant="ghost" className="mt-3 rounded-full" onClick={() => { setGeneratedItinerary(undefined); setWalkingMode("standard"); setScreen("itinerary"); }}>Preview sample itinerary</Button>
        </section>
      )}

      {screen === "itinerary" && (
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-7 sm:px-7 sm:pt-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#2f7a61]"><span className="h-2 w-2 rounded-full bg-[#3f9d7b]" /> READY TO REVIEW</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Your shared five-day Tokyo draft</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{walkingMode === "reduced" ? "A gentler version with shorter visits, seated breaks, and ride-first transfers." : "Built around each traveler’s priority interests and your dinner decision. Review the walking pace below."}</p></div><Button variant="outline" className="rounded-full" onClick={() => setScreen("group")}><ArrowLeft className="mr-2 h-4 w-4" /> Review decisions</Button></div>
          {planStale && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ec] p-4 text-[#b64735]">Preferences or membership changed after this draft. The organizer needs to generate a new version.</p>}
          {shared.snapshot?.acceptedAt && generatedItinerary && <p role="status" className="mt-5 text-[#2f7a61]">This draft was accepted by the organizer.</p>}
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {walkingMode === "reduced" && <div role="status" className="rounded-2xl border border-[#b8d6cb] bg-[#eef7f2] p-4"><p className="flex items-center gap-2 font-semibold text-[#2f7a61]"><Footprints className="h-5 w-5" />Less-walking plan applied</p><p className="mt-2 text-sm leading-6 text-muted-foreground">All five days now include shorter browsing, more seated breaks, and ride-first transfers. Lunch, dinner, and your dinner decision stay in place. Actual steps depend on routes and venue layouts; taxis may add cost.</p></div>}
              <DailyItinerary conflictChoice={conflictChoice} budget={aggregatedAnswers.budget} walkingMode={walkingMode} generated={generatedItinerary} generatedAt={shared.snapshot?.generatedAt} access={shared.session??undefined} />
            </div>
            <aside className="space-y-4"><Card className="border-[#dce4e7] bg-[#f4f7f7] p-5"><CloudSun className="h-6 w-6 text-[#315b7d]" /><h2 className="mt-4 font-semibold">Before you book</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Opening hours, prices, and availability can change. Verify current details before purchasing tickets or making reservations.</p></Card><Card className="border-[#dce4e7] bg-white p-5"><p className="text-sm font-semibold">{generatedItinerary ? "Generated with DeepSeek" : "Sample itinerary"}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Review each traveler’s priorities, daily costs, and unresolved conflicts before accepting. Coverage has not been independently scored.</p></Card>{isOrganizer && generatedItinerary && <Button disabled={shared.busy || planStale || !!shared.snapshot?.acceptedAt} onClick={()=>shared.update("accept",{expectedRevision:group?.revision})} className="h-12 w-full rounded-full bg-[#ef6a53] text-white hover:bg-[#dc5944]">{shared.snapshot?.acceptedAt?"Accepted":"Accept this draft"}</Button>}<Button variant="outline" className="h-12 w-full rounded-full" aria-pressed={walkingMode === "reduced"} onClick={() => setWalkingMode((current) => current === "standard" ? "reduced" : "standard")}>{walkingMode === "reduced" ? "Restore original pace" : "Reduce walking"}</Button></aside>
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
