import { z } from "zod";
import type { AIItinerary } from "./ai-itinerary";
import { styleAnswersSchema, type StyleResult } from "./travel-personality.ts";

export const answersSchema = z.object({
  pace: z.enum(["slow", "balanced", "packed"]), walking: z.enum(["light", "moderate", "active"]),
  budget: z.enum(["value", "mid", "flex"]), food: z.enum(["casual", "mixed", "destination"]),
  together: z.enum(["together", "mostly", "flexible"]),
});
export const placeIds = ["sensoji", "teamlab", "meiji", "museum", "shibuya", "tsukiji"] as const;
export const placeNames: Record<string, string> = { sensoji: "Sensō-ji", teamlab: "teamLab Borderless", meiji: "Meiji Jingu", museum: "Tokyo National Museum", shibuya: "Shibuya Sky", tsukiji: "Tsukiji Outer Market" };
export const profileSchema = z.object({
  answers: answersSchema,
  placeChoices: z.record(z.enum(placeIds), z.enum(["must", "interested", "skip"])).refine(v => Object.values(v).filter(x => x === "must").length <= 3, "Choose at most three must-visits"),
  completed: z.boolean(),
  styleAnswers: styleAnswersSchema.optional(),
  topPick: z.enum(placeIds).optional(),
  shareStyle: z.boolean().default(false),
}).superRefine((profile, ctx) => {
  if (profile.topPick && profile.placeChoices[profile.topPick] !== "must") ctx.addIssue({code:"custom",path:["topPick"],message:"Your first choice must be one of your must-visits"});
  if (profile.completed && profile.styleAnswers && !profile.topPick) ctx.addIssue({code:"custom",path:["topPick"],message:"Choose your first-priority attraction"});
  if (profile.shareStyle && !profile.styleAnswers) ctx.addIssue({code:"custom",path:["shareStyle"],message:"Complete the style questions before sharing a result"});
});
export const nicknameSchema = z.string().trim().min(1).max(40);
export const codeSchema = z.string().trim().toUpperCase().regex(/^TS-[A-F0-9]{24}$/);
export const decisionSchema = z.enum(["alternative", "optional", "exception"]);
export type Profile = z.infer<typeof profileSchema>;
export type GroupMember = { id: string; name: string; role: "organizer" | "member"; completed: boolean; sharedStyle?: StyleResult };
export type GroupSnapshot = {
  group: { code: string; name: string; createdAt: string; revision: number };
  members: GroupMember[]; currentMemberId: string;
  responses: Record<string, Profile & { updatedAt: string }>;
  itinerary?: AIItinerary; planRevision: number | null; conflictChoice: z.infer<typeof decisionSchema>; acceptedAt: string | null;
  generatedAt: string | null;
};

function majority(values: string[], fallback: string) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a,b) => b[1]-a[1])[0]?.[0] ?? fallback;
}
function lowest(values: string[], order: string[]) { return order.find(v => values.includes(v)) ?? order[0]; }
export function aggregateProfiles(profiles: Profile[]) {
  if (!profiles.length) throw new Error("No completed profiles");
  return answersSchema.parse({
    pace: majority(profiles.map(p => p.answers.pace), "balanced"),
    walking: lowest(profiles.map(p => p.answers.walking), ["light", "moderate", "active"]),
    budget: lowest(profiles.map(p => p.answers.budget), ["value", "mid", "flex"]),
    food: majority(profiles.map(p => p.answers.food), "mixed"),
    together: lowest(profiles.map(p => p.answers.together), ["together", "mostly", "flexible"]),
  });
}
