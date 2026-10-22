import { authorize, checkOrigin, GroupError, quota } from "./group-store.ts";
import { cachedEvidence, providerSlot, saveEvidence } from "./evidence-cache.ts";
import { restaurantRequest, searchRestaurants } from "./restaurant-search.ts";
import { searchOSMRestaurants, type OSMRestaurants } from "./osm-restaurants.ts";
export async function groupRestaurants(db:D1Database,request:Request,apiKey?:string,fetcher:typeof fetch=fetch){
  checkOrigin(request);const query=new URL(request.url).searchParams,member=await authorize(db,query.get("group")??"",request);
  const day=query.get("day"),meal=query.get("meal"),input=restaurantRequest(day,meal,query.get("budget"));
  if(!input)throw new GroupError(400,"Choose a valid trip day, meal and budget.");
  await quota(db,"restaurants",member.id,30,3600);
  if(apiKey){await quota(db,"google-restaurants","shared-site-budget",100,3600);try{return {restaurants:await searchRestaurants(input,apiKey,fetcher),source:"google_places",checkedAt:new Date().toISOString(),cached:false};}catch{throw new GroupError(502,"Google restaurant search is unavailable. No current candidates were verified. Try later or explore on Google Maps.");}}
  const key=`osm-restaurants:v1:${day}:${meal}`,cached=await cachedEvidence<OSMRestaurants>(db,key);if(cached)return {...cached,cached:true};
  await quota(db,"photon-search","shared-site-budget",120,3600);await providerSlot(db,"photon-search",1100);
  try{const result=await searchOSMRestaurants(day!,meal as "lunch"|"dinner",fetcher);await saveEvidence(db,key,result,86400000);return result;}
  catch{throw new GroupError(502,"The restaurant directory is temporarily unavailable. Google Places is not configured. Use Explore on Google Maps; no price, hours or availability have been verified.");}
}
