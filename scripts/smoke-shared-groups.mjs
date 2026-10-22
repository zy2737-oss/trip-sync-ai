// Creates and deletes only its own test group. --generate makes ONE real provider request.
import assert from "node:assert/strict";
const base=new URL(process.argv[2]??"http://127.0.0.1:8787").origin;
const generate=process.argv.includes("--generate");
const withStyles=process.argv.includes("--styles");
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
  let summary=await call(path,"GET",owner);const mine=await call(path,"GET",friend);
  assert.equal(summary.members.length,2);assert.equal(Object.keys(summary.responses).length,2);assert.equal(Object.keys(mine.responses).length,1);
  await call(path+"/accept","POST",friend,{expectedRevision:summary.group.revision},403);
  if(generate){
    summary=await call(path+"/itinerary","POST",owner,{expectedRevision:summary.group.revision,conflictChoice:"alternative"});
    assert.equal(summary.itinerary.days.length,5);
    const restored=await call(path,"GET",friend);assert.equal(restored.itinerary.days.length,5);
    await call(path+"/accept","POST",owner,{expectedRevision:summary.group.revision});
    await call(path+"/profile","PUT",friend,profile);
    await call(path+"/accept","POST",owner,{expectedRevision:summary.group.revision},409);
  }
  console.log(JSON.stringify({storage:"passed",separateCredentials:"passed",memberPrivacy:"passed",styles:withStyles?"passed (persistence, opt-in and first priority)":"not requested",generation:generate?"passed (one live request)":"not requested"}));
}finally{
  if(owner){await call(`/api/groups/${owner.code}`,"DELETE",owner);console.log("Removed only the automated QA group and its profiles.");}
}
