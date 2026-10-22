import { z } from "zod";
import { authorize, checkOrigin, quota, readBody } from "./group-store.ts";
import { cachedEvidence, providerSlot, saveEvidence } from "./evidence-cache.ts";
import { assessRoute, fetchRoutingMatrix, routeCheckSchema, routingIds, routingCacheKey, type RoutingMatrix } from "./route-check.ts";
import { factSources, fetchOfficialFacts, type AttractionFacts, type FactId } from "./attraction-facts.ts";

export async function checkGroupRoute(db:D1Database,code:string,request:Request,fetcher:typeof fetch=fetch){
  checkOrigin(request);const member=await authorize(db,code,request);
  const input=routeCheckSchema.parse(await readBody(request,16384));
  await quota(db,"route-check",member.id,60,3600);
  const ids=routingIds(input.day,input.stops);
  if(ids.length<2)return assessRoute(input,null);
  const key=routingCacheKey(ids,input.mode),cached=await cachedEvidence<RoutingMatrix>(db,key);
  if(cached)return assessRoute(input,cached,true);
  await quota(db,"routing-provider","shared-site-budget",120,3600);
  await providerSlot(db,"fossgis-routing",1100);
  try{
    const matrix=await fetchRoutingMatrix(ids,input.mode,fetcher);
    await saveEvidence(db,key,matrix);
    return assessRoute(input,matrix);
  }catch{
    return {...assessRoute(input,null),attemptedAt:new Date().toISOString(),message:"Routing service unavailable or incomplete. Distances and travel times remain unverified. Try again later or open external directions."};
  }
}
export async function checkGroupFacts(db:D1Database,code:string,request:Request,fetcher:typeof fetch=fetch):Promise<AttractionFacts>{
  checkOrigin(request);const member=await authorize(db,code,request);
  const {id}=z.object({id:z.enum(Object.keys(factSources) as [FactId,...FactId[]])}).parse(await readBody(request,512));
  await quota(db,"fact-check",member.id,60,3600);
  const key=`official-facts:v1:${id}`,cached=await cachedEvidence<AttractionFacts>(db,key);
  if(cached)return {...cached,cached:true};
  await providerSlot(db,`official:${new URL(factSources[id].url).hostname}`,1100);
  try{const result=await fetchOfficialFacts(id,fetcher);await saveEvidence(db,key,result);return result;}
  catch(error){
    // Fixed public source ID and error kind only. Never log bodies, credentials or profiles.
    console.warn("TripSync official-source lookup failed",{id,error:error instanceof Error?error.name:"Unknown",reason:error instanceof Error?error.message.slice(0,160):"Unknown"});
    const result:AttractionFacts={id,source:factSources[id],queriedAt:new Date().toISOString(),hours:null,admission:null,closure:null,cached:false,status:"unavailable",note:"The official page could not be read. No hours, price or opening-date claim has been verified. Use the source link directly."};
    await saveEvidence(db,key,result,600000);return result;
  }
}
