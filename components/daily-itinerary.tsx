"use client";
import { useState } from "react";
import { MapPin, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RestaurantOptions } from "@/components/restaurant-options";
import { adjustWalking, type WalkingMode } from "@/lib/itinerary-walking";
import type { AIItinerary } from "@/lib/ai-itinerary";
import { DailyRouteMap } from "@/components/daily-route-map";
import { StopFactSources } from "@/components/stop-fact-sources";
import { evidenceTime, RouteCheckPanel, type EvidenceAccess } from "@/components/route-check-panel";
import { buildDailyRoute,directionsUrl } from "@/lib/daily-route";

type Stop = { time: string; title: string; detail: string; meal?: "Lunch" | "Dinner"; cost?: string; locationId?: import("@/lib/daily-route").LocationId;customActivityId?:string };
type Day = { day: string; title: string; area: string; people: string; note: string; stops: Stop[] };

export function DailyItinerary({ conflictChoice, budget, walkingMode, generated, generatedAt, access }: { conflictChoice: string; budget: string; walkingMode: WalkingMode; generated?: AIItinerary; generatedAt?:string|null; access?:EvidenceAccess }) {
  const [selected,setSelected]=useState<Record<string,{number:number;version:number}>>({});
  function select(day:string,number:number,fromMap=false){setSelected(s=>({...s,[day]:{number,version:(s[day]?.version??0)+1}}));document.getElementById(fromMap?`day-${day}-stop-${number}`:`day-${day}-map`)?.scrollIntoView({behavior:"instant",block:"start"});}
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
    <p className="text-xs text-muted-foreground">{generated?"AI draft":"Sample itinerary"} · Tokyo time · JPY (Japanese yen) · Estimates, not bookings</p>
    <details className="rounded-xl border border-[#dce4e7] bg-white px-4 py-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">{generated?`Plan summary & review notes (${generated.reviewNotes.length})`:"About this sample"}</summary>
      {generated&&<><p className="mt-2 text-sm leading-6 text-muted-foreground">{generated.summary}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{generated.reviewNotes.map((note,i)=><li key={i}>{note.replace(/\s*\(custom-[a-f0-9-]{36}\)/gi,"")}</li>)}</ul></>}
      <p className="my-3 text-xs leading-5 text-muted-foreground">{generated?`DeepSeek${generatedAt?` · ${evidenceTime(generatedAt)}`:" · Date unavailable"}`:"Team-authored example"}. Hours, tickets and full-day costs need checking. <a href="/data-use" className="underline">Data &amp; sources</a></p>
    </details>
    {generated?.reviewNotes.filter(note=>/not scheduled|omitt|cannot fit|outside (?:the|our|daily)|conflicts? with/i.test(note)).slice(0,2).map((note,i)=><p key={i} className="rounded-xl bg-[#fff5ed] px-4 py-3 text-sm text-[#a44832]">{note.replace(/\s*\(custom-[a-f0-9-]{36}\)/gi,"")}</p>)}
    {(generated?.days ?? days).map((day) => {const stops=adjustWalking(day.day,day.stops,walkingMode),route=buildDailyRoute(day.day,stops);return <Card key={day.day} className="overflow-hidden border-[#dce4e7] bg-white shadow-sm">
      <div className="grid sm:grid-cols-[88px_1fr]">
        <div className="flex items-center justify-between bg-[#17384d] p-5 text-white sm:flex-col sm:items-start sm:justify-start sm:gap-2"><span className="text-sm font-semibold tracking-[0.16em] text-white/70">DAY</span><span className="text-4xl font-semibold">{day.day}</span></div>
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-semibold">{day.title}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{day.area}</p></div><Badge variant="outline" className="w-fit whitespace-normal border-[#c9d7db]">{walkingMode === "reduced" ? "Less walking · More seated breaks" : day.note}</Badge></div>
          <div id={`day-${day.day}-map`} className="scroll-mt-20"><DailyRouteMap day={day.day} stops={stops} selected={selected[day.day]?.number} focusVersion={selected[day.day]?.version} onSelect={number=>select(day.day,number,true)}/></div>
          <ol className="mt-5 space-y-3" aria-label={`Day ${day.day} schedule`}>
            {stops.map((stop,index) => {const point=route[index],previous=route[index-1],walking=previous&&directionsUrl(previous,point,"walking"),transit=previous&&directionsUrl(previous,point,"transit");return <li id={`day-${day.day}-stop-${index+1}`} key={`${stop.time}-${stop.title}`} className={`scroll-mt-20 rounded-2xl border p-4 ${selected[day.day]?.number===index+1?"ring-2 ring-[#315b7d]":""} ${stop.meal ? "border-[#f2c6bb] bg-[#fff5f1]" : "border-transparent bg-[#f3f6f6]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-3"><button type="button" disabled={!point.location} onClick={()=>select(day.day,index+1)} aria-label={`Show activity ${index+1} on Day ${day.day} map`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#17384d] font-semibold text-white disabled:opacity-50">{index+1}</button><span className="text-sm font-semibold tabular-nums text-[#315b7d]">{stop.time}</span></div>{stop.meal && <span className="flex items-center gap-1.5 text-sm font-semibold text-[#b74d38]"><Utensils className="h-4 w-4" />{stop.meal}</span>}</div>
              <h3 className="mt-2 text-base font-semibold">{stop.title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{stop.detail}</p>
              {(!point.location||point.approximate)&&<p className="mt-2 text-xs text-muted-foreground">{point.location?`≈ ${point.location.name}`:"Location unconfirmed · not mapped"}</p>}
              {walking&&transit&&<div className="mt-2 flex flex-wrap gap-3 text-xs text-[#315b7d]"><a href={walking} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">{index} → {index+1}: walking directions</a><a href={transit} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Public transport directions</a></div>}
              {stop.cost && <p className="mt-2 text-sm font-medium text-[#17384d]">Est. {stop.cost.replace(/¥/g,"JPY ")}</p>}
              <StopFactSources title={stop.title} locationId={stop.locationId} meal={stop.meal} generated={!!generated} access={access} customActivityId={"customActivityId" in stop?stop.customActivityId as string:undefined} />
              {stop.meal&&<RestaurantOptions day={day.day} meal={stop.meal} budget={day.day==="04"&&stop.meal==="Dinner"?(conflictChoice==="exception"?"premium":conflictChoice==="optional"?"flex":"mid"):budget} area={stop.title} access={access}/>}
            </li>;})}
          </ol>
          <details className="mt-5 rounded-xl border border-[#c9d7db] p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Check travel distances &amp; schedule gaps</summary><RouteCheckPanel day={day.day} stops={stops} access={access}/></details>
        </div>
      </div>
    </Card>;})}
  </div>;
}
