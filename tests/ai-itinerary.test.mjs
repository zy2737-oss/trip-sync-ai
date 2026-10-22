import test from "node:test";
import assert from "node:assert/strict";
import { itineraryInputSchema, itineraryOutputSchema, parseAIItinerary, generateAIItinerary, ItineraryProviderError } from "../lib/ai-itinerary.ts";

const input = { answers: { pace: "balanced", walking: "moderate", budget: "mid", food: "mixed", together: "mostly" }, mustVisits: ["teamLab Borderless"], conflictChoice: "optional" };
const example = () => ({ summary: "Fits the group.", reviewNotes: ["Companion profiles are simulated; verify travel details."], days: [1,2,3,4,5].map(n => ({ day: `0${n}`, title: "Tokyo day", area: "Tokyo", people: "Group", note: "Balanced", stops: [
  { time: "10:00–11:30", title: "Activity", detail: "Visit.", lowWalkingTitle: "Short visit", lowWalkingDetail: "Visit then rest." },
  { time: "12:00–13:00", title: "Lunch", detail: "Seated meal.", meal: "Lunch", cost: "Estimated ¥1,500" },
  { time: "14:00–16:00", title: "Afternoon", detail: "Explore.", lowWalkingTitle: "Café break", lowWalkingDetail: "Rest instead." },
  { time: "18:30–20:30", title: "Dinner", detail: "Meal.", meal: "Dinner", cost: "Estimated ¥2,000" },
] })) });

test("requires all five days, both meals and non-overlapping times", () => {
  assert.ok(itineraryOutputSchema.safeParse(example()).success);
  for (const mutation of [p => p.days.pop(), p => p.days[0].stops.splice(1,1), p => p.days[0].stops[2].time = "12:30–16:00", p => p.days[1].day = "01", p => delete p.days[0].stops[0].lowWalkingTitle]) {
    const plan = example(); mutation(plan);
    assert.equal(itineraryOutputSchema.safeParse(plan).success, false);
  }
});

test("organizer's dinner choice is enforced for every option", () => {
  for (const [choice, title] of [["alternative", "Casual sushi together"], ["optional", "Two dinner options, one reunion"], ["exception", "Group sushi splurge"]]) {
    const plan = parseAIItinerary(JSON.stringify(example()), { ...input, conflictChoice: choice });
    assert.equal(plan.days[3].stops.at(-1).title, title);
    assert.equal(plan.days[0].area, "Asakusa · Ueno");
  }
});

test("input limits prevent arbitrary large prompts", () => {
  assert.ok(itineraryInputSchema.safeParse(input).success);
  assert.equal(itineraryInputSchema.safeParse({ ...input, mustVisits: ["a", "b", "c", "d"] }).success, false);
  assert.equal(itineraryInputSchema.safeParse({ ...input, answers: { ...input.answers, pace: "arbitrary instructions" } }).success, false);
});

test("uses server authorization, JSON mode and non-thinking generation", async () => {
  const plan = await generateAIItinerary(input, "test-key", "deepseek-flash", async (url, init) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(init.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.thinking.type, "disabled");
    assert.equal(body.response_format.type, "json_object");
    assert.equal(body.max_tokens, 6000);
    return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(example()) } }] });
  });
  assert.equal(plan.days.length, 5);
  await assert.rejects(generateAIItinerary(input, "test-key", "deepseek-flash", async () => new Response("", { status: 402 })), error => error instanceof ItineraryProviderError && error.status === 402);
  await assert.rejects(generateAIItinerary(input, "test-key", "deepseek-flash", async () => Response.json({ choices: [{ finish_reason: "length", message: { content: "{}" } }] })), /Incomplete/);
});

test("custom stop IDs survive generation, never claim a catalog pin, and unknown IDs are rejected",()=>{
  const id="custom-12345678-1234-1234-1234-123456789012";
  const activity={id,name:"Tokyo Tower",priority:"must",timing:"Flexible",location:"Minato",description:"Short visit"};
  const customInput={...input,travelers:[{label:"Traveler 1",answers:input.answers,mustVisits:["Tokyo Tower"],customActivities:[activity]}]};
  const p=example();p.days[0].stops[0]={...p.days[0].stops[0],title:"Tokyo Tower",customActivityId:id,locationId:"sensoji"};
  const result=parseAIItinerary(JSON.stringify(p),customInput);
  assert.equal(result.days[0].stops[0].customActivityId,id);assert.equal(result.days[0].stops[0].locationId,undefined);
  assert.equal(result.reviewNotes.some(n=>n.includes("Custom must-visit not scheduled")),false);
  assert.throws(()=>parseAIItinerary(JSON.stringify(p),input),/Unknown custom/);
  const travelers=Array.from({length:12},(_,i)=>({label:`Traveler ${i+1}`,answers:input.answers,mustVisits:[],customActivities:Array.from({length:3},(_,j)=>({...activity,id:`custom-${String(i*3+j).padStart(8,"0")}-1234-1234-1234-123456789012`,name:`${i}-${j}-`+"x".repeat(90)}))}));
  const missing=parseAIItinerary(JSON.stringify(example()),{...input,travelers});
  assert.ok(missing.reviewNotes.length<=12);assert.ok(missing.reviewNotes.every(n=>n.length<=600));
  for(const traveler of travelers)for(const activity of traveler.customActivities)assert.ok(missing.reviewNotes.some(n=>n.includes(activity.name)));
});
