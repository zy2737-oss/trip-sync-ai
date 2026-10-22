import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tripGroups = sqliteTable("trip_groups", {
  code: text("code").primaryKey(), name: text("name").notNull(),
  createdAt: text("created_at").notNull(), revision: integer("revision").notNull().default(0),
  itinerary: text("itinerary"), planRevision: integer("plan_revision"),
  conflictChoice: text("conflict_choice").notNull().default("alternative"),
  acceptedAt: text("accepted_at"), generatingUntil: integer("generating_until").notNull().default(0),
});
export const tripMembers = sqliteTable("trip_members", {
  id: text("id").primaryKey(), groupCode: text("group_code").notNull().references(() => tripGroups.code, { onDelete: "cascade" }),
  name: text("name").notNull(), nameKey: text("name_key").notNull(),
  tokenHash: text("token_hash").notNull(), role: text("role").notNull(),
  answers: text("answers"), placeChoices: text("place_choices"),
  styleAnswers: text("style_answers"), topPick: text("top_pick"),
  shareStyle: integer("share_style").notNull().default(0),
  completed: integer("completed").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("member_group_name").on(t.groupCode, t.nameKey), uniqueIndex("member_token").on(t.tokenHash)]);
export const groupRateLimits = sqliteTable("group_rate_limits", {
  key: text("key").primaryKey(), hits: integer("hits").notNull(), expiresAt: integer("expires_at").notNull(),
});
