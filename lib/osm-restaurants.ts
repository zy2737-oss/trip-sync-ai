import { routeLocations, type LocationId } from "./daily-route.ts";
import type { Restaurant } from "./restaurant-search.ts";
const areas:Record<string,[LocationId,LocationId]>={"01":["asakusa","ueno"],"02":["harajuku","shibuya"],"03":["azabudai","roppongi"],"04":["tsukiji","ginza"],"05":["shimokitazawa","shinjuku"]};
export type OSMRestaurants={restaurants:Restaurant[];source:"openstreetmap";checkedAt:string;cached:boolean;note:string};
export async function searchOSMRestaurants(day:string,meal:"lunch"|"dinner",fetcher:typeof fetch=fetch):Promise<OSMRestaurants>{
  if(!Object.hasOwn(areas,day)||(meal!=="lunch"&&meal!=="dinner"))throw new Error("Unsupported meal");
  const point=routeLocations[areas[day][meal==="lunch"?0:1]];
  // A documented Photon category query in a fixed public neighborhood. No personal text/location.
  const url=new URL("https://photon.komoot.io/api/");
  Object.entries({include:"osm.amenity.restaurant",lat:String(point.lat),lon:String(point.lng),bbox:`${point.lng-.008},${point.lat-.006},${point.lng+.008},${point.lat+.006}`,lang:"en",limit:"3"}).forEach(([key,value])=>url.searchParams.set(key,value));
  const response=await fetcher(url,{headers:{Accept:"application/json","User-Agent":"TripSyncAI-coursework/1.0 (+https://tripsync-ai-tokyo.yannnnnzj.chatgpt.site)"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("Restaurant directory unavailable");
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty restaurant response");
  const decoder=new TextDecoder();let raw="",size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>200000){await reader.cancel();throw new Error("Restaurant response too large");}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  const data=JSON.parse(raw) as {features?:{properties?:Record<string,unknown>;geometry?:{type?:string;coordinates?:number[]}}[]};
  if(!Array.isArray(data.features))throw new Error("Incomplete restaurant response");
  const restaurants:Restaurant[]=[],seen=new Set<string>();
  for(const row of data.features.slice(0,20)){
    const p=row.properties??{},[lng,lat]=row.geometry?.coordinates??[],kind={N:"node",W:"way",R:"relation"}[String(p.osm_type)];
    if(!kind||!Number.isSafeInteger(p.osm_id)||typeof p.name!=="string"||!p.name.trim()||p.osm_key!=="amenity"||p.osm_value!=="restaurant"||p.countrycode!=="JP"||row.geometry?.type!=="Point")continue;
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat-point.lat)>.0061||Math.abs(lng-point.lng)>.0081)continue;
    const id=`${kind}-${p.osm_id}`;if(seen.has(id))continue;seen.add(id);
    const address=[p.housenumber,p.street,p.locality,p.district,p.city,p.postcode,p.country].filter(v=>typeof v==="string"&&v.trim()).join(", ").slice(0,240);
    restaurants.push({id,name:p.name.slice(0,140),address:address||`Near ${point.name}; exact address not supplied`,mapsUrl:`https://www.openstreetmap.org/${kind}/${p.osm_id}`,hours:[],attributions:[{name:"© OpenStreetMap contributors",url:"https://www.openstreetmap.org/copyright"}]});
    if(restaurants.length===3)break;
  }
  return {restaurants,source:"openstreetmap",checkedAt:new Date().toISOString(),cached:false,note:"OpenStreetMap directory candidates via Photon near the planned meal area, not live availability. Cuisine, budget band, menu prices and hours have NOT been filtered or verified. Check directly before choosing. Google Places is not configured for this site."};
}
