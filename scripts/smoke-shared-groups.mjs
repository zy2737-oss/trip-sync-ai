// Creates and deletes only its own test group. --generate makes ONE real provider request.
import assert from "node:assert/strict";
const base=new URL(process.argv[2]??"http://127.0.0.1:8787").origin;
const generate=process.argv.includes("--generate");
let owner;
async function call(path,method="GET",session,body,expected=200){
  const response=await fetch(base+path,{method,signal:AbortSignal.timeout(85000),headers:{Origin:base,...(body?{"Content-Type":"application/json"}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();assert.equal(response.status,expected,data.message??`Unexpected status ${response.status}`);return data;
}
const profile={answers:{pace:"slow",walking:"light",budget:"value",food:"casual",together:"mostly"},placeChoices:{sensoji:"must",teamlab:"interested",meiji:"interested",museum:"interested",shibuya:"interested",tsukiji:"interested"},completed:true};
try{
  owner=await call("/api/groups","POST",null,{name:"Automated shared-group QA",nickname:"QA Organizer"});
  const friend=await call("/api/groups/join","POST",null,{code:owner.code,nickname:"QA Friend"});
  const path=`/api/groups/${owner.code}`;
  await call(path,"GET",null,undefined,401);
  await call(path+"/profile","PUT",owner,profile);
  await call(path+"/profile","PUT",friend,{...profile,answers:{...profile.answers,budget:"mid"}});
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
  console.log(JSON.stringify({storage:"passed",separateCredentials:"passed",memberPrivacy:"passed",generation:generate?"passed (one live request)":"not requested"}));
}finally{
  if(owner){await call(`/api/groups/${owner.code}`,"DELETE",owner);console.log("Removed only the automated QA group and its profiles.");}
}
