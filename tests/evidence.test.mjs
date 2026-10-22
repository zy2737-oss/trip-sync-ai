import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { routeCheckSchema, fetchRoutingMatrix, assessRoute, routingIds } from "../lib/route-check.ts";
import { parseOfficialFacts, fetchOfficialFacts } from "../lib/attraction-facts.ts";
import { fetchPlaceCatalog } from "../lib/place-data.ts";
import { checkGroupRoute, checkGroupFacts } from "../lib/group-evidence.ts";
import { createGroup, GroupError } from "../lib/group-store.ts";

function database(){const sql=new DatabaseSync(":memory:");sql.exec("PRAGMA foreign_keys = ON");const journal=JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json",import.meta.url),"utf8"));for(const entry of journal.entries)sql.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),"utf8"));const db={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)??null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){const result=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}};},async batch(statements){sql.exec("BEGIN");try{const r=[];for(const s of statements)r.push(await s.run());sql.exec("COMMIT");return r;}catch(e){sql.exec("ROLLBACK");throw e;}}};return {db,sql};}
const request=(body,token)=>new Request("https://trip.test/api/groups",{method:"POST",headers:{Origin:"https://trip.test","Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
const stop=(time,title,locationId)=>({time,title,detail:"",...(locationId?{locationId}:{})});
const input={day:"01",mode:"walking",stops:[stop("09:00–10:00","Temple","sensoji"),stop("10:10–11:00","Museum","museum")]};
const matrix={ids:["sensoji","museum"],distances:[[0,2400],[2400,0]],durations:[[0,1800],[1800,0]],snapDistances:[10,10],queriedAt:"2026-10-22T10:00:00.000Z"};
const routingResponse=()=>Response.json({code:"Ok",distances:[[0,2400],[2400,0]],durations:[[0,1800],[1800,0]],sources:[{distance:10},{distance:10}]});
const museumHtml="<h2>Hours</h2><p>9:30 a.m. – 5:00 p.m.</p><h3>TNM Collection Exhibitions</h3><table><tr><td>Adults</td><td>1,000 yen</td></tr><tr><td>University Students</td><td>500 yen</td></tr></table><h2>Closed</h2><p>Mondays (Excluding holidays)</p>";

test("route inputs are bounded catalog IDs, never arbitrary URLs or user coordinates",()=>{
  assert.ok(routeCheckSchema.safeParse(input).success);
  assert.equal(routeCheckSchema.safeParse({...input,mode:"transit"}).success,false);
  assert.equal(routeCheckSchema.safeParse({...input,stops:Array(9).fill(input.stops[0])}).success,false);
  assert.equal(routeCheckSchema.safeParse({...input,stops:[input.stops[0],{...input.stops[1],locationId:"https://internal/"}]}).success,false);
});
test("walking uses the real foot profile, longitude-first coordinates and provider units",async()=>{
  const result=await fetchRoutingMatrix(["sensoji","museum"],"walking",async(url,init)=>{assert.match(url,/routed-foot\/table\/v1\/foot\/139\.7955265,35\.7134032/);assert.match(url,/annotations=distance,duration/);assert.ok(init.headers["User-Agent"].includes("TripSync"));assert.equal(init.headers.Authorization,undefined);return routingResponse();});
  assert.equal(result.distances[0][1],2400);assert.equal(result.durations[0][1],1800);
  await fetchRoutingMatrix(["sensoji","museum"],"driving",async(url)=>{assert.match(url,/routed-car\/table\/v1\/car/);return routingResponse();});
  await assert.rejects(fetchRoutingMatrix(["sensoji","museum"],"walking",async()=>Response.json({code:"NoTable"})),/No routed path/);
});
test("schedule conflicts, transfer blocks, duplicate pins and missing locations stay distinct",()=>{
  assert.equal(assessRoute(input,matrix).legs[0].status,"too_short");
  const fits={...input,stops:[input.stops[0],stop("11:00–12:00","Museum","museum")]};
  assert.equal(assessRoute(fits,matrix).legs[0].status,"estimated_gap");
  const mixed={...input,stops:[input.stops[0],stop("10:00–11:00","Transfer to museum + buffer","museum")]};
  assert.equal(assessRoute(mixed,matrix).legs[0].status,"review");
  const missing={...input,stops:[input.stops[0],stop("10:10–11:00","Unknown hotel"),input.stops[1]]};
  const partial=assessRoute(missing,matrix);assert.equal(partial.checkedLegs,0);assert.equal(partial.legs[0].distanceMeters,undefined);assert.equal(partial.legs[1].status,"unknown");
  const same=assessRoute({...input,stops:[input.stops[0],stop("10:10–11:00","Temple rest","sensoji")]},null);assert.equal(same.legs[0].status,"same_anchor");assert.equal(same.legs[0].distanceMeters,undefined);
  const noRoute=assessRoute(input,{...matrix,distances:[[0,null],[null,0]]});assert.equal(noRoute.legs[0].status,"unknown");assert.equal(noRoute.checkedLegs,0);
});
test("area estimates and large network snapping never become entrance-level verification",()=>{
  const snapped=assessRoute(input,{...matrix,snapDistances:[500,0]});assert.equal(snapped.legs[0].status,"review");
  const meals={...input,stops:[input.stops[0],{...input.stops[1],meal:"Lunch"}]};
  const idList=routingIds("01",meals.stops);assert.ok(idList.includes("asakusa"));assert.equal(idList.includes("museum"),false);
});
test("official parsers return dated fields and preserve unknowns rather than inventing facts",async()=>{
  const stamp="2026-10-22T10:00:00.000Z",facts=parseOfficialFacts("museum",museumHtml,stamp);
  assert.match(facts.hours,/9:30/);assert.match(facts.admission,/1,000/);assert.match(facts.admission,/Special exhibitions/);assert.match(facts.closure,/holiday/);assert.equal(facts.queriedAt,stamp);
  const changed=parseOfficialFacts("museum","<h1>Page changed</h1>",stamp);assert.equal(changed.hours,null);assert.equal(changed.admission,null);assert.equal(changed.status,"partial");
  const scripted=parseOfficialFacts("museum",`<script>${museumHtml}</script>`,stamp);assert.equal(scripted.hours,null);
  const seasonal=parseOfficialFacts("meiji","Meiji Jingu is open every day throughout the year with free of charge. October 5:40 am 4:40 pm",stamp);assert.match(seasonal.hours,/October/);assert.ok(seasonal.admission);
  const negative=parseOfficialFacts("meiji","Entry is not free of charge",stamp);assert.equal(negative.admission,null);
  const dynamic=parseOfficialFacts("teamlab","Hours 8:30 - 21:00 Adults 18 and above JPY 3,400 Tickets are subject to a dynamic pricing system",stamp);assert.match(dynamic.admission,/not a ticket quote/);
  await assert.rejects(fetchOfficialFacts("museum",async()=>new Response("unavailable",{status:503})),/unavailable/);
});
test("cached queries retain original dates and provider rate slots are shared across members",async()=>{
  const {db,sql}=database();const owner=await createGroup(db,request({name:"QA",nickname:"Owner"}));let calls=0;
  const fetcher=async()=>{calls++;return routingResponse();};
  const first=await checkGroupRoute(db,owner.code,request(input,owner.token),fetcher);
  const second=await checkGroupRoute(db,owner.code,request(input,owner.token),fetcher);
  assert.equal(calls,1);assert.equal(second.cached,true);assert.equal(first.queriedAt,second.queriedAt);
  await assert.rejects(checkGroupRoute(db,owner.code,request({...input,mode:"driving"},owner.token),fetcher),e=>e instanceof GroupError&&e.status===429);assert.equal(calls,1);
  await assert.rejects(checkGroupRoute(db,owner.code,request(input,"a".repeat(64)),fetcher),e=>e instanceof GroupError&&e.status===403);
  sql.close();
});
test("official-source checks are authorized, cached and explicit about failed extraction",async()=>{
  const {db,sql}=database();const owner=await createGroup(db,request({name:"QA",nickname:"Owner"}));let calls=0;
  const fetcher=async(url)=>{calls++;assert.match(url,/^https:\/\/www\.tnm\.jp\//);return new Response(museumHtml);};
  const one=await checkGroupFacts(db,owner.code,request({id:"museum"},owner.token),fetcher);
  const two=await checkGroupFacts(db,owner.code,request({id:"museum"},owner.token),fetcher);
  assert.equal(calls,1);assert.equal(two.cached,true);assert.equal(one.queriedAt,two.queriedAt);
  const failed=await checkGroupFacts(db,owner.code,request({id:"shibuya"},owner.token),async()=>new Response("x",{status:503}));
  assert.equal(failed.status,"unavailable");assert.equal(failed.admission,null);
  sql.close();
});
test("live Places data keeps stable IDs and does not claim unmatched demo cards were queried",async()=>{
  const places=await fetchPlaceCatalog("test-key",async()=>Response.json({places:[{id:"provider-museum",displayName:{text:"Tokyo National Museum"},rating:4.8,businessStatus:"OPERATIONAL"},{id:"unrelated",displayName:{text:"An unrelated place"},rating:5}]}));
  const museum=places.find(p=>p.id==="museum"),temple=places.find(p=>p.id==="sensoji");
  assert.equal(museum.source,"google_places");assert.ok(museum.checkedAt);assert.equal(temple.source,"demo");assert.equal(temple.checkedAt,null);assert.equal(places.length,6);assert.equal(places.some(p=>p.id==="unrelated"),false);
});
