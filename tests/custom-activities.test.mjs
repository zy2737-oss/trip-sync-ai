import test from "node:test";
import assert from "node:assert/strict";
import { searchActivityPlaces, customActivitySchema } from "../lib/custom-activities.ts";
import { profileSchema } from "../lib/group-contract.ts";
import { buildDailyRoute } from "../lib/daily-route.ts";
import { routeCheckSchema, assessRoute } from "../lib/route-check.ts";

const id="custom-12345678-1234-1234-1234-123456789012";
const activity={id,name:"Pottery workshop",priority:"must",timing:"Day 2 afternoon, 2 hours",location:"Asakusa; exact venue not decided",description:"A beginner seated pottery class"};
const answers={pace:"slow",walking:"light",budget:"value",food:"casual",together:"together"};
const feature=(p={},coordinates=[139.745536,35.6584491])=>({type:"Feature",properties:{name:"Tokyo Tower",osm_id:4247312,osm_type:"R",city:"Tokyo",country:"Japan",countrycode:"JP",...p},geometry:{type:"Point",coordinates}});
test("custom requests keep explicit uncertainty and share one combined must-visit limit",()=>{
  const profile={answers,placeChoices:{sensoji:"must",museum:"must"},completed:true,customActivities:[activity],topPick:id};
  assert.equal(profileSchema.safeParse(profile).success,true);
  assert.equal(profileSchema.safeParse({...profile,placeChoices:{...profile.placeChoices,meiji:"must"}}).success,false);
  assert.equal(profileSchema.safeParse({...profile,customActivities:[{...activity,priority:"interested"}]}).success,false);
  assert.equal(profileSchema.safeParse({...profile,customActivities:[activity,activity]}).success,false);
  assert.equal(customActivitySchema.safeParse({...activity,location:""}).success,false);
  assert.equal(customActivitySchema.safeParse({...activity,description:"x".repeat(401)}).success,false);
  assert.equal(profileSchema.parse({answers,placeChoices:{},completed:true}).customActivities.length,0);
});
test("place search calls only Photon with a bounded query, Tokyo bounds, real IDs and dated results",async()=>{
  const result=await searchActivityPlaces("Tokyo Tower",async(url,init)=>{
    assert.equal(url.origin,"https://photon.komoot.io");assert.equal(url.searchParams.get("q"),"Tokyo Tower");assert.equal(url.searchParams.get("limit"),"3");assert.equal(url.searchParams.get("bbox"),"138.5,34.8,141,36.5");
    assert.ok(init.signal);assert.equal(init.headers.Authorization,undefined);
    return Response.json({features:[feature(),feature(),feature({name:"Outside"},[0,0]),feature({countrycode:"US"}),feature({osm_type:"bad"}),feature({name:"Other",osm_id:123})]});
  });
  assert.equal(result.candidates.length,2);assert.equal(result.candidates[0].id,"relation-4247312");assert.equal(result.candidates[0].lat,35.6584491);assert.equal(result.candidates[0].lng,139.745536);assert.ok(Date.parse(result.queriedAt));
  assert.equal(result.candidates[0].queriedAt,result.queriedAt);
  await assert.rejects(searchActivityPlaces("a",()=>{throw Error("must not call")}),/./);
});
test("empty, failed and malformed searches never invent a candidate",async()=>{
  assert.deepEqual((await searchActivityPlaces("obscure event",async()=>Response.json({features:[]}))).candidates,[]);
  await assert.rejects(searchActivityPlaces("Tower",async()=>new Response("",{status:503})),/unavailable/);
  await assert.rejects(searchActivityPlaces("Tower",async()=>Response.json({wrong:[]})),/Invalid/);
  await assert.rejects(searchActivityPlaces("Tower",async()=>new Response("x".repeat(200001))),/too large/);
});
test("custom activities never inherit a guessed catalog pin or fake route distance",()=>{
  const stops=[{time:"09:00–10:00",title:"Sensō-ji",detail:"Visit",locationId:"sensoji"},{time:"10:00–11:00",title:"Sensō-ji pottery workshop",detail:"Unknown venue",locationId:"sensoji",customActivityId:id},{time:"11:00–12:00",title:"Rest break",detail:"Rest"}];
  const route=buildDailyRoute("01",stops);assert.equal(route[1].location,undefined);assert.equal(route[2].location,undefined);
  const parsed=routeCheckSchema.parse({day:"01",mode:"walking",stops});const result=assessRoute(parsed,null);
  assert.equal(result.checkedLegs,0);assert.ok(result.legs.every(l=>l.status==="unknown"));
});
