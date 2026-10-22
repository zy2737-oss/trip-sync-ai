import { z } from "zod";

export const styleIds = ["slow", "landmark", "food", "culture", "spontaneous", "together"] as const;
export type StyleId = typeof styleIds[number];
export const travelStyles: Record<StyleId, { name: string; shortName: string; tagline: string; description: string; cue: string; color: string; softColor: string }> = {
  slow: { name: "The Slow Wanderer", shortName: "Slow Wanderer", tagline: "More breathing room. More little discoveries.", description: "You enjoy noticing a place, not racing through it. A great trip leaves room to pause, settle in and take it all in.", cue: "Consider fewer anchors and unhurried breaks, unless your explicit pace choice says otherwise.", color: "#547862", softColor: "#e9f1e8" },
  landmark: { name: "The Landmark Collector", shortName: "Landmark Collector", tagline: "The places you have dreamed of, finally in view.", description: "You love the signature sights and the memories they create. Seeing a city's defining places makes a trip feel special.", cue: "Prioritize signature sights and useful photo stops without overruling anyone's budget or walking limit.", color: "#b76142", softColor: "#fae9de" },
  food: { name: "The Flavor Seeker", shortName: "Flavor Seeker", tagline: "Every good day has something delicious in it.", description: "Food is part of how you get to know a place. Markets, neighborhood meals and memorable flavors belong in your travel story.", cue: "Give local food experiences time and attention within the group's stated budget.", color: "#a8752d", softColor: "#fbf0d8" },
  culture: { name: "The Culture Diver", shortName: "Culture Diver", tagline: "Go beyond the postcard. Find the story.", description: "You are drawn to the stories behind a place. Museums, historic streets and local traditions help you understand where you are.", cue: "Consider cultural visits and time to understand them, while respecting explicit pace and mobility choices.", color: "#70618f", softColor: "#eee9f5" },
  spontaneous: { name: "The Free Explorer", shortName: "Free Explorer", tagline: "A little room for the unexpected.", description: "You enjoy following your curiosity. A loose plan, an unfamiliar street and an unexpected discovery can make your day.", cue: "Leave a flexible block near the planned area; keep timed tickets and group meetups explicit.", color: "#3d7e87", softColor: "#e3f1f1" },
  together: { name: "The Together Traveler", shortName: "Together Traveler", tagline: "The best part of the trip is who comes along.", description: "Shared moments matter to you. You notice how everyone is feeling and value experiences that become group memories.", cue: "Consider shared experiences and clear reunion points; use the separate group-style answer to decide whether splits are allowed.", color: "#ad647c", softColor: "#f7e8ee" },
};

export const styleAnswersSchema = z.object({
  bestDay: z.enum(["slow", "landmark", "food", "culture"]),
  freeTime: z.enum(["slow", "culture", "spontaneous", "together"]),
  memory: z.enum(["landmark", "food", "culture", "together"]),
  rain: z.enum(["slow", "landmark", "spontaneous", "together"]),
  research: z.enum(["landmark", "food", "culture", "spontaneous"]),
  disappointment: z.enum(["slow", "food", "spontaneous", "together"]),
});
export type StyleAnswers = z.infer<typeof styleAnswersSchema>;
export type StyleResult = { primary: StyleId[]; secondary?: StyleId; balanced: boolean };
type StyleQuestion = { key: keyof StyleAnswers; eyebrow: string; title: string; help: string; options: [StyleId, string, string][] };
export const styleQuestions: StyleQuestion[] = [
  { key: "bestDay", eyebrow: "YOUR KIND OF DAY", title: "What makes a travel day feel well spent?", help: "Pick the one that sounds most like you on this trip.", options: [
    ["slow", "Taking it all in", "An unhurried stroll, a proper break and time to notice the little things."],
    ["landmark", "Seeing the icons", "Finally visiting the places that make this city unmistakable."],
    ["food", "Finding wonderful food", "Tasting local favorites and discovering a meal worth remembering."],
    ["culture", "Understanding the place", "Learning something about its history, traditions or everyday life."],
  ] },
  { key: "freeTime", eyebrow: "A LITTLE FREE TIME", title: "You have two unexpected hours after lunch. What next?", help: "There is no wrong answer. Go with your first instinct.", options: [
    ["slow", "Find a cozy café", "Sit down, recharge and enjoy having nowhere to rush."],
    ["culture", "Visit a small museum", "Explore a nearby exhibition or historic building."],
    ["spontaneous", "Follow an unfamiliar street", "See what you discover without picking an exact destination."],
    ["together", "Ask the group", "Find something everyone feels like doing together."],
  ] },
  { key: "memory", eyebrow: "THE STORY YOU BRING HOME", title: "What would you be most excited to share afterward?", help: "Imagine telling a friend about the highlight of your trip.", options: [
    ["landmark", "The sights and photos", "The views, landmarks and moments you finally captured."],
    ["food", "That unforgettable meal", "The flavors and food spots you would go back for."],
    ["culture", "The stories you learned", "Something that changed how you understand the place."],
    ["together", "The moments with friends", "The funny detours and memories you made together."],
  ] },
  { key: "rain", eyebrow: "A CHANGE OF PLANS", title: "Rain cancels your outdoor activity. What feels best?", help: "Think about your preferred response, not what you think you should do.", options: [
    ["slow", "Make it a slower afternoon", "A comfortable indoor break sounds like a welcome change."],
    ["landmark", "Choose a backup sight", "Swap in an indoor attraction already on your wish list."],
    ["spontaneous", "See what is nearby", "Find a new possibility and decide in the moment."],
    ["together", "Decide together", "Check what everyone wants before choosing a new activity."],
  ] },
  { key: "research", eyebrow: "BEFORE YOU GO", title: "What would you most enjoy researching?", help: "Choose the information you would naturally look for first.", options: [
    ["landmark", "Must-see sights and viewpoints", "Which landmarks to visit and where to get a great view."],
    ["food", "Markets and local food", "What to eat and which neighborhoods have interesting meals."],
    ["culture", "History and local culture", "The stories, exhibitions and traditions behind the destination."],
    ["spontaneous", "A few interesting neighborhoods", "Get a feel for the area and leave the details open."],
  ] },
  { key: "disappointment", eyebrow: "WHAT YOU WOULD RATHER AVOID", title: "What would disappoint you most in a trip plan?", help: "Pick the thing you would most want the organizer to understand.", options: [
    ["slow", "No room to breathe", "A full schedule with hardly a moment to pause."],
    ["food", "Meals are an afterthought", "Eating whatever is convenient without any local flavor."],
    ["spontaneous", "Every minute is decided", "No freedom to follow a new idea or unexpected discovery."],
    ["together", "Too few shared moments", "Seeing lots of places but barely enjoying time with friends."],
  ] },
];

// Equal opportunity: each style appears four times. No budget or walking data enters this score.
export function scoreTravelStyle(raw: unknown): StyleResult | null {
  const parsed = styleAnswersSchema.safeParse(raw); if (!parsed.success) return null;
  const scores = Object.fromEntries(styleIds.map(id => [id, 0])) as Record<StyleId, number>;
  Object.values(parsed.data).forEach(id => scores[id]++);
  const max = Math.max(...Object.values(scores));
  const primary = styleIds.filter(id => scores[id] === max);
  const secondary = primary.length === 1 ? styleIds.find(id => scores[id] >= 2 && id !== primary[0]) : undefined;
  return { primary, ...(secondary ? { secondary } : {}), balanced: primary.length > 2 };
}
export function styleTitle(result: StyleResult) {
  return result.balanced ? "Your Own Blend" : result.primary.map(id => travelStyles[id].shortName).join(" × ");
}
export function groupStyleNotes(results: StyleResult[]): string[] {
  if (!results.length) return [];
  const present = new Set(results.filter(r => !r.balanced).flatMap(r => r.primary)); const notes: string[] = [];
  if (present.has("slow") && present.has("landmark")) notes.push("Mix signature sights with generous breaks. A landmark-heavy wish list does not have to mean a packed day.");
  if (present.has("food")) notes.push("Give meals a place in the plan, rather than squeezing them between activities. Check the actual budget before choosing a splurge.");
  if (present.has("culture")) notes.push("Leave enough time to explore the stories behind a cultural stop, instead of treating every visit as a quick photo.");
  if (present.has("spontaneous")) notes.push("Try a free-exploration block near the day's main stops, with a clear meeting time.");
  if (present.has("together")) notes.push("Make space for shared memories. Whether anyone can split off still depends on the explicit group-style answers.");
  if (!notes.length) notes.push("Start with a few shared anchors and room to pause. Use the practical answers below to set the actual pace and limits.");
  return notes.slice(0, 3);
}
