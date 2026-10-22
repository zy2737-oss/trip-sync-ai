import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { styleIds, styleQuestions, styleAnswersSchema, scoreTravelStyle, styleTitle } from "../lib/travel-personality.ts";
import { profileSchema } from "../lib/group-contract.ts";

test("six brief questions give each of the six styles exactly four scoring opportunities",()=>{
  assert.equal(styleQuestions.length,6);const counts=Object.fromEntries(styleIds.map(id=>[id,0]));
  for(const q of styleQuestions){assert.equal(q.options.length,4);for(const [id] of q.options)counts[id]++;}
  assert.deepEqual(Object.values(counts),[4,4,4,4,4,4]);
});
test("all styles are reachable, deterministic, and independent of financial or mobility constraints",()=>{
  for(const id of styleIds){
    const answers=Object.fromEntries(styleQuestions.map(q=>[q.key,q.options.find(o=>o[0]===id)?.[0]??q.options[0][0]]));
    const result=scoreTravelStyle(answers);assert.deepEqual(result.primary,[id]);assert.equal(result.balanced,false);
    assert.deepEqual(scoreTravelStyle({...answers,budget:"value",walking:"light"}),result);
    assert.deepEqual(scoreTravelStyle(answers),result);
  }
  assert.equal(scoreTravelStyle({}),null);
  assert.equal(styleAnswersSchema.safeParse({bestDay:"spontaneous"}).success,false);
});
test("ties remain blends rather than arbitrary labels; a flat result is explicitly balanced",()=>{
  const dual=scoreTravelStyle({bestDay:"food",freeTime:"slow",memory:"food",rain:"slow",research:"food",disappointment:"slow"});
  assert.deepEqual(dual.primary,["slow","food"]);assert.equal(dual.balanced,false);assert.match(styleTitle(dual),/×/);
  const flat=scoreTravelStyle({bestDay:"slow",freeTime:"culture",memory:"landmark",rain:"together",research:"spontaneous",disappointment:"food"});
  assert.equal(flat.balanced,true);assert.equal(styleTitle(flat),"Your Own Blend");
});
test("new style profiles require a first pick among must-visits; legacy submissions remain valid",()=>{
  const base={answers:{pace:"slow",walking:"light",budget:"value",food:"casual",together:"together"},placeChoices:{sensoji:"must"},completed:true};
  assert.equal(profileSchema.safeParse(base).success,true);
  const styleAnswers=Object.fromEntries(styleQuestions.map(q=>[q.key,q.options[0][0]]));
  assert.equal(profileSchema.safeParse({...base,styleAnswers}).success,false);
  assert.equal(profileSchema.safeParse({...base,styleAnswers,topPick:"teamlab"}).success,false);
  assert.equal(profileSchema.safeParse({...base,styleAnswers,topPick:"sensoji"}).success,true);
  assert.equal(profileSchema.safeParse({...base,shareStyle:true}).success,false);
});
test("additive migration keeps old members and their planning answers unchanged",()=>{
  const sql=new DatabaseSync(":memory:");sql.exec(readFileSync(new URL("../drizzle/0000_known_layla_miller.sql",import.meta.url),"utf8"));
  sql.prepare("INSERT INTO trip_groups (code,name,created_at) VALUES ('old','Original trip','2026-10-01')").run();
  sql.prepare("INSERT INTO trip_members (id,group_code,name,name_key,token_hash,role,answers,updated_at) VALUES ('person','old','Friend','friend','hash','member',?,'2026-10-01')").run('{"budget":"value"}');
  const journal=JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json",import.meta.url),"utf8"));
  for(const entry of journal.entries.slice(1))sql.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),"utf8"));
  const row=sql.prepare("SELECT * FROM trip_members WHERE id='person'").get();
  assert.equal(row.answers,'{"budget":"value"}');assert.equal(row.style_answers,null);assert.equal(row.top_pick,null);assert.equal(row.share_style,0);sql.close();
});
