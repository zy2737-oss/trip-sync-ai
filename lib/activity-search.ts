import { authorize, checkOrigin, GroupError, hashToken, quota, readBody } from "./group-store.ts";
import { activitySearchSchema, candidateCacheKey, searchActivityPlaces, type ActivitySearchResult } from "./custom-activities.ts";
import { cachedEvidence, providerSlot, saveEvidence } from "./evidence-cache.ts";

export async function searchGroupActivities(db:D1Database,code:string,request:Request,fetcher:typeof fetch=fetch){
  checkOrigin(request);const member=await authorize(db,code,request);
  const {query}=activitySearchSchema.parse(await readBody(request,1024));
  await quota(db,"activity-search",member.id,30,3600);
  const key=`activity-search:v1:${await hashToken(query.normalize("NFKC").toLowerCase())}`;
  const cached=await cachedEvidence<ActivitySearchResult>(db,key);if(cached)return {...cached,cached:true};
  await quota(db,"photon-search","shared-site-budget",120,3600);await providerSlot(db,"photon-search",1100);
  try{
    const result=await searchActivityPlaces(query,fetcher);
    // Query text is not persisted in the shared cache, only public place results and dates.
    for(const candidate of result.candidates)await saveEvidence(db,candidateCacheKey(candidate),candidate,86400000);
    await saveEvidence(db,key,result);
    return result;
  }catch{throw new GroupError(502,"Place search is unavailable. Try again or describe the activity manually below; no match has been confirmed.");}
}
