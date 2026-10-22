import { z } from "zod";
import { aggregateProfiles, codeSchema, decisionSchema, nicknameSchema, placeNames, profileSchema, type GroupSnapshot, type Profile } from "./group-contract.ts";
import { generateAIItinerary, ItineraryProviderError } from "./ai-itinerary.ts";
import { scoreTravelStyle } from "./travel-personality.ts";

export class GroupError extends Error { status:number; constructor(status: number, message: string) { super(message); this.status=status; } }
type GroupRow = { code: string; name: string; created_at: string; revision: number; itinerary: string | null; plan_revision: number | null; conflict_choice: string; accepted_at: string | null; generated_at: string | null; generating_until: number };
type MemberRow = { id: string; group_code: string; name: string; role: "organizer" | "member"; answers: string | null; place_choices: string | null; style_answers: string | null; top_pick: string | null; share_style: number; completed: number; updated_at: string };
const now = () => new Date().toISOString();
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,"0")).join("");
export async function hashToken(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2,"0")).join(""); }
export async function readBody(request: Request, limit = 8192): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new GroupError(413,"Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new GroupError(400,"A JSON body is required.");
  let size = 0; const parts: Uint8Array[] = [];
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if(size > limit) { await reader.cancel(); throw new GroupError(413,"Request is too large."); } parts.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for(const part of parts) { bytes.set(part,offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new GroupError(400,"Invalid JSON."); }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new GroupError(403,"Cross-site writes are not allowed.");
}
export async function quota(db: D1Database, scope: string, identity: string, limit: number, seconds: number) {
  const stamp = Math.floor(Date.now()/1000); const window = Math.floor(stamp/seconds);
  const key = `${scope}:${await hashToken(identity)}:${window}`;
  const row = await db.prepare("INSERT INTO group_rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits = hits + 1 RETURNING hits").bind(key,(window+1)*seconds).first<{hits:number}>();
  if ((row?.hits ?? limit + 1) > limit) throw new GroupError(429,"Too many requests. Please wait before trying again.");
  await db.prepare("DELETE FROM group_rate_limits WHERE expires_at < ?").bind(stamp-86400).run();
}
function bearer(request: Request) { const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]; if(!token) throw new GroupError(401,"This device has no access to this group. Use an invitation to join."); return token; }
export async function authorize(db: D1Database, code: string, request: Request, organizer = false) {
  const validCode = codeSchema.parse(code);
  const member = await db.prepare("SELECT id,group_code,name,role,answers,place_choices,style_answers,top_pick,share_style,completed,updated_at FROM trip_members WHERE group_code = ? AND token_hash = ?").bind(validCode,await hashToken(bearer(request))).first<MemberRow>();
  if(!member) throw new GroupError(403,"Your access is no longer valid. Rejoin using an invitation.");
  if(organizer && member.role !== "organizer") throw new GroupError(403,"Only the organizer can do this.");
  return member;
}
async function groupRow(db:D1Database,code:string) { const group = await db.prepare("SELECT * FROM trip_groups WHERE code = ?").bind(code).first<GroupRow>(); if(!group) throw new GroupError(404,"Group not found."); return group; }
async function memberRows(db:D1Database,code:string) { return (await db.prepare("SELECT id,group_code,name,role,answers,place_choices,style_answers,top_pick,share_style,completed,updated_at FROM trip_members WHERE group_code = ? ORDER BY updated_at,id").bind(code).all<MemberRow>()).results; }
function profileOf(member:MemberRow):Profile | undefined { if(!member.answers || !member.place_choices) return; return profileSchema.parse({answers:JSON.parse(member.answers),placeChoices:JSON.parse(member.place_choices),completed:!!member.completed, ...(member.style_answers ? {styleAnswers:JSON.parse(member.style_answers)} : {}), ...(member.top_pick ? {topPick:member.top_pick} : {}),shareStyle:!!member.share_style}); }
export async function snapshot(db:D1Database,code:string,request:Request):Promise<GroupSnapshot> {
  const me = await authorize(db,code,request); const group = await groupRow(db,code); const members = await memberRows(db,code);
  const responses:GroupSnapshot["responses"] = {};
  for(const member of members) { if(me.role !== "organizer" && member.id !== me.id) continue; const profile=profileOf(member); if(profile) responses[member.id]={...profile,updatedAt:member.updated_at}; }
  return {group:{code:group.code,name:group.name,createdAt:group.created_at,revision:group.revision},currentMemberId:me.id,
    members:members.map(m=>{const result=m.completed && m.share_style && m.style_answers ? scoreTravelStyle(JSON.parse(m.style_answers)) : null;return {id:m.id,name:m.name,role:m.role,completed:!!m.completed,...(result?{sharedStyle:result}:{})};}),responses,
    itinerary:group.itinerary ? JSON.parse(group.itinerary) : undefined, planRevision:group.plan_revision,
    conflictChoice:decisionSchema.parse(group.conflict_choice),acceptedAt:group.accepted_at,generatedAt:group.generated_at??null};
}
export async function createGroup(db:D1Database,request:Request) {
  checkOrigin(request); const input=z.object({name:z.string().trim().min(1).max(80),nickname:nicknameSchema}).parse(await readBody(request));
  await quota(db,"create",request.headers.get("cf-connecting-ip")??"local",10,3600);
  const code=`TS-${secret().slice(0,24).toUpperCase()}`, token=secret(), id=crypto.randomUUID(), stamp=now();
  await db.batch([
    db.prepare("INSERT INTO trip_groups (code,name,created_at) VALUES (?,?,?)").bind(code,input.name,stamp),
    db.prepare("INSERT INTO trip_members (id,group_code,name,name_key,token_hash,role,updated_at) VALUES (?,?,?,?,?,'organizer',?)").bind(id,code,input.nickname,input.nickname.toLowerCase(),await hashToken(token),stamp),
  ]);
  return {code,token};
}
export async function joinGroup(db:D1Database,request:Request) {
  checkOrigin(request); const input=z.object({code:codeSchema,nickname:nicknameSchema}).parse(await readBody(request));
  await quota(db,"join",request.headers.get("cf-connecting-ip")??"local",30,3600);
  await groupRow(db,input.code);
  const token=secret(), id=crypto.randomUUID();
  try {
    const result=await db.prepare("INSERT INTO trip_members (id,group_code,name,name_key,token_hash,role,updated_at) SELECT ?,?,?,?,?,'member',? WHERE (SELECT count(*) FROM trip_members WHERE group_code = ?) < 12 RETURNING id").bind(id,input.code,input.nickname,input.nickname.toLowerCase(),await hashToken(token),now(),input.code).first();
    if(!result) throw new GroupError(409,"This prototype supports up to 12 travelers per group.");
  } catch(error) { if(error instanceof GroupError) throw error; if(String(error).includes("UNIQUE")) throw new GroupError(409,"That nickname is already taken. Use a different nickname; nicknames do not recover access."); throw error; }
  await db.prepare("UPDATE trip_groups SET revision = revision + 1, accepted_at = NULL WHERE code = ?").bind(input.code).run();
  return {code:input.code,token};
}
export async function saveProfile(db:D1Database,code:string,request:Request) {
  checkOrigin(request); const me=await authorize(db,code,request); const input=profileSchema.parse(await readBody(request));
  await quota(db,"save",me.id,60,60);
  // A server-side revision invalidates plans made from older preferences.
  await db.batch([
    db.prepare("UPDATE trip_members SET answers = ?, place_choices = ?, style_answers = ?, top_pick = ?, share_style = ?, completed = ?, updated_at = ? WHERE id = ? AND group_code = ?").bind(JSON.stringify(input.answers),JSON.stringify(input.placeChoices),input.styleAnswers?JSON.stringify(input.styleAnswers):null,input.topPick??null,input.shareStyle?1:0,input.completed?1:0,now(),me.id,code),
    db.prepare("UPDATE trip_groups SET revision = revision + 1, accepted_at = NULL WHERE code = ?").bind(code),
  ]);
  return snapshot(db,code,request);
}
export async function generateGroupPlan(db:D1Database,code:string,request:Request,apiKey?:string,model?:string,fetcher:typeof fetch=fetch) {
  checkOrigin(request); const me=await authorize(db,code,request,true);
  const input=z.object({conflictChoice:decisionSchema,expectedRevision:z.number().int().nonnegative()}).parse(await readBody(request));
  const group=await groupRow(db,code), members=await memberRows(db,code);
  if(group.revision!==input.expectedRevision) throw new GroupError(409,"Group answers changed. Refresh the summary before generating.");
  if(!members.length || members.some(m=>!m.completed)) throw new GroupError(409,"Wait until every traveler has submitted a profile.");
  if(!apiKey) throw new GroupError(503,"AI generation is not connected. Ask the organizer to check the API configuration.");
  const profiles=members.map(m=>profileOf(m)!); const answers=aggregateProfiles(profiles);
  if(input.conflictChoice==="optional" && answers.together==="together") throw new GroupError(409,"A traveler requires staying together. Choose a shared lower-cost dinner, or discuss changing that preference first.");
  await quota(db,"generate",code,3,600);
  const lease=Date.now()+90000;
  const lock=await db.prepare("UPDATE trip_groups SET generating_until = ? WHERE code = ? AND revision = ? AND generating_until < ? RETURNING code").bind(lease,code,group.revision,Date.now()).first();
  if(!lock) throw new GroupError(409,"Another draft is being generated, or the group changed. Refresh and try again shortly.");
  try {
    const travelers=members.map((m,i)=>{const profile=profiles[i],travelStyle=scoreTravelStyle(profile.styleAnswers);return {label:`Traveler ${i+1}`,answers:profile.answers,mustVisits:Object.entries(profile.placeChoices).filter(([,v])=>v==="must").map(([id])=>placeNames[id]),...(profile.topPick?{topPick:placeNames[profile.topPick]}:{}),...(travelStyle?{travelStyle}:{})};});
    const mustVisits=[...new Set(travelers.flatMap(t=>t.mustVisits))];
    const plan=await generateAIItinerary({answers,mustVisits,conflictChoice:input.conflictChoice,travelers},apiKey,model,fetcher);
    const saved=await db.prepare("UPDATE trip_groups SET itinerary = ?, plan_revision = ?, conflict_choice = ?, generated_at = ?, accepted_at = NULL WHERE code = ? AND revision = ? AND generating_until = ? RETURNING code").bind(JSON.stringify(plan),group.revision,input.conflictChoice,now(),code,group.revision,lease).first();
    if(!saved) throw new GroupError(409,"A traveler updated their profile during generation. Refresh and generate from the latest answers.");
    return snapshot(db,code,request);
  } catch(error) {
    if(error instanceof GroupError) throw error;
    if(error instanceof ItineraryProviderError && error.status===402) throw new GroupError(502,"The AI account needs credit. Your profiles are saved; try again after adding credit.");
    throw new GroupError(502,"AI generation failed. Your profiles are saved. Please try again later.");
  } finally { await db.prepare("UPDATE trip_groups SET generating_until = 0 WHERE code = ? AND generating_until = ?").bind(code,lease).run(); }
}
export async function acceptPlan(db:D1Database,code:string,request:Request) {
  checkOrigin(request); await authorize(db,code,request,true);
  const input=z.object({expectedRevision:z.number().int().nonnegative()}).parse(await readBody(request));
  const result=await db.prepare("UPDATE trip_groups SET accepted_at = ? WHERE code = ? AND revision = ? AND plan_revision = revision AND itinerary IS NOT NULL RETURNING code").bind(now(),code,input.expectedRevision).first();
  if(!result) throw new GroupError(409,"This draft is out of date. Refresh and generate a new draft before accepting.");
  return snapshot(db,code,request);
}
export async function deleteGroup(db:D1Database,code:string,request:Request) {
  checkOrigin(request); await authorize(db,code,request,true);
  await db.prepare("DELETE FROM trip_groups WHERE code = ?").bind(code).run();
  return {deleted:true};
}
