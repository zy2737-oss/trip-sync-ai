import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createGroup, joinGroup, snapshot, saveProfile, generateGroupPlan, acceptPlan, deleteGroup, hashToken, GroupError } from "../lib/group-store.ts";

// SQLite-backed D1 adapter: executes the real migration, SQL, authorization and generation flow.
function database() {
  const sql=new DatabaseSync(":memory:");sql.exec("PRAGMA foreign_keys = ON");
  sql.exec(readFileSync(new URL("../drizzle/0000_known_layla_miller.sql",import.meta.url),"utf8"));
  const db={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){const result=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};},async batch(statements){sql.exec("BEGIN");try{const results=[];for(const s of statements)results.push(await s.run());sql.exec("COMMIT");return results;}catch(e){sql.exec("ROLLBACK");throw e;}}};
  return {db,sql};
}
function req(body,token,method="POST") {return new Request("https://trip.test/api/groups",{method,headers:{"Content-Type":"application/json",Origin:"https://trip.test",...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const answers={pace:"balanced",walking:"moderate",budget:"mid",food:"mixed",together:"mostly"};
const profile=(changes={},places={teamlab:"must"})=>({answers:{...answers,...changes},placeChoices:places,completed:true});
const rejected=(status)=>e=>e instanceof GroupError&&e.status===status;
async function setup(){const {db,sql}=database();const owner=await createGroup(db,req({name:"Test Tokyo",nickname:"Organizer"}));const friend=await joinGroup(db,req({code:owner.code,nickname:"Friend"}));return {db,sql,owner,friend};}
const plan=()=>({summary:"Real group preferences.",reviewNotes:["Verify travel data before booking."],days:[1,2,3,4,5].map(n=>({day:`0${n}`,title:"Tokyo",area:"Tokyo",people:"Traveler 1 + Traveler 2",note:"Balanced",stops:[
  {time:"10:00–11:00",title:"Activity",detail:"Visit",lowWalkingTitle:"Rest",lowWalkingDetail:"Seated break"},
  {time:"12:00–13:00",title:"Lunch",detail:"Lunch",meal:"Lunch"},
  {time:"14:00–15:00",title:"Activity",detail:"Visit",lowWalkingTitle:"Rest",lowWalkingDetail:"Seated break"},
  {time:"18:30–20:00",title:"Dinner",detail:"Dinner",meal:"Dinner"},
]}))});
const provider=async()=>Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(plan())}}]});

test("separate device credentials share submitted data without exposing tokens or others' answers",async()=>{
  const {db,sql,owner,friend}=await setup();
  await saveProfile(db,owner.code,req(profile({budget:"value"}),owner.token,"PUT"));
  await saveProfile(db,owner.code,req(profile({walking:"light"}),friend.token,"PUT"));
  const organizer=await snapshot(db,owner.code,req(undefined,owner.token,"GET"));
  const member=await snapshot(db,owner.code,req(undefined,friend.token,"GET"));
  assert.equal(organizer.members.length,2);assert.equal(Object.keys(organizer.responses).length,2);
  assert.equal(Object.keys(member.responses).length,1);assert.equal(member.members.filter(m=>m.completed).length,2);
  assert.equal(JSON.stringify(organizer).includes(owner.token),false);
  const stored=sql.prepare("SELECT token_hash FROM trip_members WHERE role='organizer'").get();
  assert.equal(stored.token_hash,await hashToken(owner.token));assert.notEqual(stored.token_hash,owner.token);
  await assert.rejects(snapshot(db,owner.code,req(undefined,undefined,"GET")),rejected(401));
  await assert.rejects(snapshot(db,owner.code,req(undefined,"a".repeat(64),"GET")),rejected(403));
  sql.close();
});
test("member identity comes from credential, not a supplied member ID; organizer operations stay protected",async()=>{
  const {db,sql,owner,friend}=await setup();const snap=await snapshot(db,owner.code,req(undefined,owner.token,"GET"));
  await saveProfile(db,owner.code,req({...profile(),memberId:snap.currentMemberId},friend.token,"PUT"));
  assert.equal(sql.prepare("SELECT completed FROM trip_members WHERE role='organizer'").get().completed,0);
  await assert.rejects(generateGroupPlan(db,owner.code,req({conflictChoice:"alternative",expectedRevision:2},friend.token),"key"),rejected(403));
  await assert.rejects(deleteGroup(db,owner.code,req(undefined,friend.token,"DELETE")),rejected(403));
  await assert.rejects(joinGroup(db,req({code:owner.code,nickname:"friend"})),rejected(409));
  const bad=new Request("https://trip.test/api/groups",{method:"POST",headers:{Origin:"https://attacker.test"},body:"{}"});
  await assert.rejects(createGroup(db,bad),rejected(403));sql.close();
});
test("generation requires every submission and uses actual profiles, their union of must-visits and conservative limits",async()=>{
  const {db,sql,owner,friend}=await setup();
  let snap=await snapshot(db,owner.code,req(undefined,owner.token,"GET"));
  await assert.rejects(generateGroupPlan(db,owner.code,req({conflictChoice:"alternative",expectedRevision:snap.group.revision},owner.token),"key"),rejected(409));
  await saveProfile(db,owner.code,req(profile({budget:"value"},{teamlab:"must",sensoji:"must",museum:"must"}),owner.token,"PUT"));
  snap=await saveProfile(db,owner.code,req(profile({walking:"light",together:"together"},{shibuya:"must",tsukiji:"must",meiji:"must"}),friend.token,"PUT"));
  await assert.rejects(generateGroupPlan(db,owner.code,req({conflictChoice:"optional",expectedRevision:snap.group.revision},owner.token),"key"),rejected(409));
  const generated=await generateGroupPlan(db,owner.code,req({conflictChoice:"alternative",expectedRevision:snap.group.revision},owner.token),"key",undefined,async(url,init)=>{
    const body=JSON.parse(init.body),input=JSON.parse(body.messages[1].content);
    assert.equal(input.travelers.length,2);assert.equal(input.mustVisits.length,6);
    assert.equal(input.answers.budget,"value");assert.equal(input.answers.walking,"light");assert.equal(input.answers.together,"together");
    assert.equal(JSON.stringify(input).includes("Organizer"),false);assert.equal(JSON.stringify(input).includes("Friend"),false);
    return provider();
  });
  assert.equal(generated.itinerary.days.length,5);assert.equal(generated.planRevision,generated.group.revision);
  const accepted=await acceptPlan(db,owner.code,req({expectedRevision:generated.group.revision},owner.token));assert.ok(accepted.acceptedAt);
  const viewed=await snapshot(db,owner.code,req(undefined,friend.token,"GET"));assert.equal(viewed.itinerary.days.length,5);
  await saveProfile(db,owner.code,req(profile({budget:"flex"}),friend.token,"PUT"));
  await assert.rejects(acceptPlan(db,owner.code,req({expectedRevision:generated.group.revision},owner.token)),rejected(409));
  const changed=await snapshot(db,owner.code,req(undefined,owner.token,"GET"));assert.equal(changed.acceptedAt,null);assert.notEqual(changed.planRevision,changed.group.revision);sql.close();
});
test("profile changes during generation cannot publish a stale result",async()=>{
  const {db,sql,owner,friend}=await setup();
  await saveProfile(db,owner.code,req(profile(),owner.token,"PUT"));
  const snap=await saveProfile(db,owner.code,req(profile(),friend.token,"PUT"));
  await assert.rejects(generateGroupPlan(db,owner.code,req({conflictChoice:"alternative",expectedRevision:snap.group.revision},owner.token),"key",undefined,async()=>{
    await saveProfile(db,owner.code,req(profile({pace:"slow"}),friend.token,"PUT"));return provider();
  }),rejected(409));
  const row=sql.prepare("SELECT itinerary,generating_until FROM trip_groups").get();assert.equal(row.itinerary,null);assert.equal(row.generating_until,0);sql.close();
});
test("deleting a group removes its profiles and saved plan",async()=>{
  const {db,sql,owner}=await setup();await deleteGroup(db,owner.code,req(undefined,owner.token,"DELETE"));
  assert.equal(sql.prepare("SELECT count(*) AS n FROM trip_groups").get().n,0);assert.equal(sql.prepare("SELECT count(*) AS n FROM trip_members").get().n,0);sql.close();
});
