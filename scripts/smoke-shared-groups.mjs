// Creates and deletes only its own test group. --generate makes ONE real provider request.
import assert from "node:assert/strict";
const base=new URL(process.argv[2]??"http://127.0.0.1:8787").origin;
const generate=process.argv.includes("--generate");
const withStyles=process.argv.includes("--styles");
const withEvidence=process.argv.includes("--evidence");
const withCustom=process.argv.includes("--custom");
let customId;
let owner;
async function call(path,method="GET",session,body,expected=200,retry=0){
  const response=await fetch(base+path,{method,signal:AbortSignal.timeout(85000),headers:{Origin:base,...(body?{"Content-Type":"application/json"}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const raw=await response.text();
  // Local workerd can briefly restart under a fast request burst. DELETE is idempotent;
  // never retry creation, generation or profile changes automatically.
  if(method==="DELETE" && response.status===503 && retry<2){await new Promise(resolve=>setTimeout(resolve,300));return call(path,method,session,body,expected,retry+1);}
  let data;try{data=JSON.parse(raw);}catch{throw new Error(`Non-JSON ${response.status} response from ${method} ${path.split("/").slice(0,3).join("/")}`);}
  assert.equal(response.status,expected,data.message??`Unexpected status ${response.status}`);return data;
}
const profile={answers:{pace:"slow",walking:"light",budget:"value",food:"casual",together:"mostly"},placeChoices:{sensoji:"must",teamlab:"interested",meiji:"interested",museum:"interested",shibuya:"interested",tsukiji:"interested"},completed:true};
try{
  owner=await call("/api/groups","POST",null,{name:"Automated shared-group QA",nickname:"QA Organizer"});
  const friend=await call("/api/groups/join","POST",null,{code:owner.code,nickname:"QA Friend"});
  const path=`/api/groups/${owner.code}`;
  await call(path,"GET",null,undefined,401);
  await call(path+"/profile","PUT",owner,profile);
  await call(path+"/profile","PUT",friend,{...profile,answers:{...profile.answers,budget:"mid"}});
  if(withStyles){
    const styleAnswers={bestDay:"food",freeTime:"slow",memory:"food",rain:"slow",research:"food",disappointment:"food"};
    await call(path+"/profile","PUT",owner,{...profile,styleAnswers,topPick:"sensoji",shareStyle:false});
    let peer=await call(path,"GET",friend);
    assert.equal(peer.members.find(m=>m.role==="organizer").sharedStyle,undefined);
    await call(path+"/profile","PUT",owner,{...profile,styleAnswers,topPick:"sensoji",shareStyle:true});
    peer=await call(path,"GET",friend);
    assert.deepEqual(peer.members.find(m=>m.role==="organizer").sharedStyle.primary,["food"]);
    assert.equal(JSON.stringify(peer).includes("bestDay"),false);
    const restored=await call(path,"GET",owner);
    assert.equal(restored.responses[restored.currentMemberId].topPick,"sensoji");
    assert.deepEqual(restored.responses[restored.currentMemberId].styleAnswers,styleAnswers);
  }
  if(withCustom){
    await call(path+"/activities/search","POST",null,{query:"Tokyo Tower"},401);
    const found=await call(path+"/activities/search","POST",owner,{query:"Tokyo Tower"});
    const match=found.candidates.find(c=>c.name==="Tokyo Tower");assert.ok(match,"Expected a real Tokyo Tower search candidate");
    const repeat=await call(path+"/activities/search","POST",friend,{query:"Tokyo Tower"});assert.equal(repeat.cached,true);assert.equal(repeat.queriedAt,found.queriedAt);
    customId=`custom-${crypto.randomUUID()}`;
    const customActivities=[{id:customId,name:match.name,priority:"must",timing:"Day 3, flexible for about 90 minutes",location:match.address,description:"See Tokyo Tower; prioritize a short visit and avoid long queues",match},{id:`custom-${crypto.randomUUID()}`,name:"Beginner pottery workshop",priority:"interested",timing:"Flexible afternoon, about 2 hours",location:"Asakusa, venue not decided",description:"A seated beginner class, optional if budget permits"}];
    await call(path+"/profile","PUT",owner,{...profile,customActivities,topPick:customId});
    const saved=await call(path,"GET",owner);assert.deepEqual(saved.responses[saved.currentMemberId].customActivities,customActivities);assert.equal(saved.responses[saved.currentMemberId].topPick,customId);
    const peer=await call(path,"GET",friend);assert.equal(JSON.stringify(peer).includes("Beginner pottery workshop"),false);
    console.log(JSON.stringify({customSearch:"passed (live Tokyo Tower match)",customProfile:"passed (matched and manual)",customPriority:"passed",customPrivacy:"passed"}));
  }
  let summary=await call(path,"GET",owner);const mine=await call(path,"GET",friend);
  assert.equal(summary.members.length,2);assert.equal(Object.keys(summary.responses).length,2);assert.equal(Object.keys(mine.responses).length,1);
  if(withEvidence){
    const route={day:"01",mode:"walking",stops:[{time:"09:00–10:00",title:"Sensō-ji",detail:"Temple visit",locationId:"sensoji"},{time:"10:00–11:00",title:"Tokyo National Museum",detail:"Museum visit",locationId:"museum"}]};
    await call(path+"/routes","POST",null,route,401);
    const checked=await call(path+"/routes","POST",owner,route);
    assert.equal(checked.checkedLegs,1,"Live routing lookup did not return a checked leg");
    assert.ok(Date.parse(checked.queriedAt));assert.ok(checked.legs[0].distanceMeters>0);assert.ok(checked.legs[0].durationSeconds>0);
    assert.equal(checked.legs[0].status,"too_short");
    const cached=await call(path+"/routes","POST",friend,route);
    assert.equal(cached.cached,true);assert.equal(cached.queriedAt,checked.queriedAt);
    await call(path+"/facts","POST",null,{id:"meiji"},401);
    const facts=await call(path+"/facts","POST",owner,{id:"meiji"});
    assert.equal(facts.status,"retrieved","Official source could not be read completely");
    assert.ok(facts.hours);assert.ok(facts.admission);assert.ok(Date.parse(facts.queriedAt));
    const cachedFacts=await call(path+"/facts","POST",friend,{id:"meiji"});
    assert.equal(cachedFacts.cached,true);assert.equal(cachedFacts.queriedAt,facts.queriedAt);
    console.log(JSON.stringify({routing:"passed (live road/path distance, duration and conflict)",officialFacts:"passed (Meiji Jingu)",cacheDates:"passed",evidenceAuth:"passed"}));
  }
  await call(path+"/accept","POST",friend,{expectedRevision:summary.group.revision},403);
  if(generate){
    summary=await call(path+"/itinerary","POST",owner,{expectedRevision:summary.group.revision,conflictChoice:"alternative"});
    assert.equal(summary.itinerary.days.length,5);
    const restored=await call(path,"GET",friend);assert.equal(restored.itinerary.days.length,5);
    assert.ok(Date.parse(restored.generatedAt));
    if(withCustom)assert.ok(restored.itinerary.days.some(d=>d.stops.some(s=>s.customActivityId===customId))||restored.itinerary.reviewNotes.some(n=>n.includes("Tokyo Tower")),"Custom must-visit must be scheduled or explicitly flagged");
    await call(path+"/accept","POST",owner,{expectedRevision:summary.group.revision});
    await call(path+"/profile","PUT",friend,profile);
    await call(path+"/accept","POST",owner,{expectedRevision:summary.group.revision},409);
  }
  console.log(JSON.stringify({storage:"passed",separateCredentials:"passed",memberPrivacy:"passed",styles:withStyles?"passed (persistence, opt-in and first priority)":"not requested",generation:generate?"passed (one live request)":"not requested"}));
}finally{
  if(owner){await call(`/api/groups/${owner.code}`,"DELETE",owner);console.log("Removed only the automated QA group and its profiles.");}
}
